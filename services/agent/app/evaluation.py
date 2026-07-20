import json
import os
import time
from urllib.parse import urlparse

import httpx
import pymysql
from agno.agent import Agent
from pydantic import BaseModel, Field

from .provider import normalize_provider, select_provider


class HomeworkEvaluation(BaseModel):
    score: float = Field(ge=0)
    feedback: str
    strengths: list[str]
    weaknesses: list[str]
    improvements: list[str]
    citations: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)


class IngestionPendingError(RuntimeError):
    pass


def _connection():
    if os.getenv("AGNO_DATABASE_URL"):
        parsed = urlparse(os.environ["AGNO_DATABASE_URL"].replace("mysql+pymysql", "mysql"))
        return pymysql.connect(host=parsed.hostname, port=parsed.port or 4000, user=parsed.username, password=parsed.password, database=parsed.path.lstrip("/"), ssl={} if os.getenv("TIDB_SSL", "true").lower() == "true" else None, cursorclass=pymysql.cursors.DictCursor)
    return pymysql.connect(host=os.getenv("TIDB_HOST", "localhost"), port=int(os.getenv("TIDB_PORT", "4000")), user=os.getenv("TIDB_USER", "root"), password=os.getenv("TIDB_PASSWORD", ""), database=os.getenv("TIDB_DATABASE", "vio_database"), ssl={} if os.getenv("TIDB_SSL", "true").lower() == "true" else None, cursorclass=pymysql.cursors.DictCursor)


async def _owner_openai_key(agent_token: str) -> str:
    base = os.environ["VIO_INTERNAL_API_URL"].rstrip("/")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{base}/api/internal/agent/credentials/openai",
            headers={"X-Vio-Agent-Token": agent_token},
        )
    if response.status_code != 200:
        raise RuntimeError("The classroom owner's OpenAI credential is unavailable")
    return str(response.json()["key"])


async def evaluate_homework(version_id: str, expected_owner_id: str, agent_token: str, trace_id: str | None = None) -> None:
    connection = _connection()
    started = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT e.id AS evaluation_id, e.status AS evaluation_status, sv.text_content, sv.version_number,
                     a.id AS assignment_id, a.title, a.instructions, a.rubric_json, a.max_marks,
                     c.owner_user_id, COALESCE(p.default_provider, 'built_in') AS provider_mode,
                     COALESCE(p.allow_built_in_fallback, FALSE) AS allow_built_in_fallback
              FROM ai_evaluations e JOIN submission_versions sv ON sv.id = e.submission_version_id
              JOIN homework_submissions s ON s.id = sv.submission_id JOIN homework_assignments a ON a.id = s.assignment_id
              JOIN classrooms c ON c.id = a.classroom_id
              LEFT JOIN user_ai_preferences p ON p.user_id = c.owner_user_id
              WHERE sv.id = %s ORDER BY e.created_at DESC, e.id DESC LIMIT 1""", (version_id,))
            row = cursor.fetchone()
            if not row:
                return
            if str(row["owner_user_id"]) != expected_owner_id:
                raise PermissionError("Homework evaluation token does not match the classroom owner")
            if row["evaluation_status"] == "completed":
                return
            cursor.execute("""SELECT COUNT(*) AS pending_count FROM knowledge_documents
              WHERE status IN ('pending','processing') AND ((scope_type='submission' AND scope_id=%s) OR (scope_type='assignment' AND scope_id=%s))""",
              (version_id, row["assignment_id"]))
            if int(cursor.fetchone()["pending_count"] or 0) > 0:
                raise IngestionPendingError("Submission files are still being processed")
            cursor.execute("""SELECT kd.file_name, kc.chunk_index, kc.content
              FROM knowledge_documents kd JOIN knowledge_chunks kc ON kc.document_id = kd.id
              WHERE kd.status='ready' AND ((kd.scope_type='submission' AND kd.scope_id=%s) OR (kd.scope_type='assignment' AND kd.scope_id=%s))
              ORDER BY kd.file_name, kc.chunk_index LIMIT 60""", (version_id, row["assignment_id"]))
            file_chunks = cursor.fetchall()
            cursor.execute("UPDATE ai_evaluations SET status='processing' WHERE id=%s", (row["evaluation_id"],))
            connection.commit()
        provider_mode = str(row["provider_mode"])
        owner_key = await _owner_openai_key(agent_token) if provider_mode == "openai_byok" else None
        selection = select_provider(provider_mode, owner_key, bool(row["allow_built_in_fallback"]))
        agent = Agent(model=selection.model, fallback_config=selection.fallback_config, instructions=[
            "You are a careful educational evaluator.",
            "Evaluate only against the teacher's instructions and rubric.",
            "Never claim certainty when the submission lacks evidence.",
            "Return constructive, age-appropriate feedback. The teacher is the final authority.",
            "Citations must contain only source labels that appear in the supplied attachment context.",
        ])
        attachment_context = "\n\n".join(f"[{chunk['file_name']} chunk {chunk['chunk_index'] + 1}]\n{chunk['content']}" for chunk in file_chunks)
        prompt = f"""Assignment: {row['title']}
Instructions: {row['instructions']}
Rubric: {row['rubric_json'] or 'Use the instructions as the rubric.'}
Maximum marks: {row['max_marks']}

Student submission, version {row['version_number']}:
{row['text_content'] or '[No text extracted]'}

Extracted assignment and submission attachments:
{attachment_context or '[No readable attachments]'}

Score must be between 0 and {row['max_marks']}."""
        output = await agent.arun(prompt, output_schema=HomeworkEvaluation)
        result = output.content if isinstance(output.content, HomeworkEvaluation) else HomeworkEvaluation.model_validate(output.content)
        result.score = min(result.score, float(row["max_marks"]))
        valid_citations = {f"{chunk['file_name']} chunk {chunk['chunk_index'] + 1}" for chunk in file_chunks}
        result.citations = [citation for citation in result.citations if citation.strip("[]") in valid_citations]
        actual_model = str(getattr(output, "model", None) or selection.model_id)
        actual_provider = normalize_provider(getattr(output, "model_provider", None), actual_model, selection.provider)
        with connection.cursor() as cursor:
            cursor.execute("""UPDATE ai_evaluations SET provider=%s, model=%s, initial_score=%s, feedback=%s, strengths=%s, weaknesses=%s, improvements=%s, citations=%s, confidence=%s, status='completed', error_code=NULL WHERE id=%s""",
                (actual_provider, actual_model, result.score, result.feedback, json.dumps(result.strengths), json.dumps(result.weaknesses), json.dumps(result.improvements), json.dumps(result.citations), result.confidence, row["evaluation_id"]))
            cursor.execute("UPDATE homework_submissions s JOIN submission_versions sv ON sv.submission_id=s.id SET s.status='evaluated' WHERE sv.id=%s AND s.current_version=sv.version_number", (version_id,))
            metrics = getattr(output, "metrics", None)
            cursor.execute("""INSERT INTO ai_usage_events
              (trace_id, user_id, provider, model, feature, input_tokens, output_tokens, latency_ms, success)
              VALUES (%s, %s, %s, %s, 'homework_evaluation', %s, %s, %s, TRUE)""",
              (trace_id, row["owner_user_id"], actual_provider, actual_model,
               int(getattr(metrics, "input_tokens", 0) or 0) if metrics else 0,
               int(getattr(metrics, "output_tokens", 0) or 0) if metrics else 0,
               int((time.monotonic() - started) * 1000)))
            connection.commit()
    except IngestionPendingError:
        connection.rollback()
        raise
    except Exception as exc:
        connection.rollback()
        failed_selection = locals().get("selection")
        failed_provider = str(getattr(failed_selection, "provider", "unknown"))
        failed_model = str(getattr(failed_selection, "model_id", "unknown"))
        with connection.cursor() as cursor:
            cursor.execute("UPDATE ai_evaluations SET status='failed', error_code=%s WHERE submission_version_id=%s AND status IN ('pending','processing')", (type(exc).__name__[:100], version_id))
            cursor.execute("UPDATE homework_submissions s JOIN submission_versions sv ON sv.submission_id=s.id SET s.status='failed' WHERE sv.id=%s", (version_id,))
            cursor.execute("""INSERT INTO ai_usage_events
              (trace_id, user_id, provider, model, feature, latency_ms, success, error_code)
              VALUES (%s, %s, %s, %s, 'homework_evaluation', %s, FALSE, %s)""",
              (trace_id, expected_owner_id, failed_provider, failed_model,
               int((time.monotonic() - started) * 1000), type(exc).__name__[:100]))
            connection.commit()
        raise
    finally:
        connection.close()
