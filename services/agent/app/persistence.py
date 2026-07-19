import json
import os
import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import unquote, urlparse

import pymysql


def _connection() -> pymysql.Connection:
    url = os.getenv("AGNO_DATABASE_URL")
    if url:
        parsed = urlparse(url.replace("mysql+pymysql", "mysql"))
        return pymysql.connect(
            host=parsed.hostname,
            port=parsed.port or 4000,
            user=unquote(parsed.username or "root"),
            password=unquote(parsed.password or ""),
            database=parsed.path.lstrip("/") or os.getenv("TIDB_DATABASE", "vio_database"),
            ssl={} if os.getenv("TIDB_SSL", "true").lower() == "true" else None,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )
    return pymysql.connect(
        host=os.getenv("TIDB_HOST", "localhost"),
        port=int(os.getenv("TIDB_PORT", "4000")),
        user=os.getenv("TIDB_USER", "root"),
        password=os.getenv("TIDB_PASSWORD", ""),
        database=os.getenv("TIDB_DATABASE", "vio_database"),
        ssl={} if os.getenv("TIDB_SSL", "true").lower() == "true" else None,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


@contextmanager
def transaction() -> Iterator[tuple[pymysql.Connection, pymysql.cursors.Cursor]]:
    connection = _connection()
    try:
        with connection.cursor() as cursor:
            yield connection, cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def stable_id(namespace: str, value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"vio:{namespace}:{value}"))


def record_event(run_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Persist lifecycle events. Token deltas stay in conversation_messages to avoid write amplification."""
    if event_type == "message.delta":
        return
    with transaction() as (_, cursor):
        cursor.execute(
            "INSERT INTO agent_events (run_id, event_type, payload) VALUES (%s, %s, %s)",
            (run_id, event_type, json.dumps(payload, default=str)),
        )
        if event_type == "done":
            cursor.execute(
                "UPDATE agent_runs SET status='completed', provider=COALESCE(NULLIF(%s, 'unknown'), provider), model=COALESCE(%s, model), completed_at=UTC_TIMESTAMP() WHERE id=%s",
                (payload.get("provider"), payload.get("model"), run_id),
            )
            cursor.execute(
                """INSERT INTO ai_usage_events (trace_id, user_id, provider, model, feature, input_tokens, output_tokens, success)
                   SELECT trace_id, user_id, provider, model, 'agent_chat', %s, %s, TRUE FROM agent_runs WHERE id=%s""",
                (int(payload.get("inputTokens") or 0), int(payload.get("outputTokens") or 0), run_id),
            )
        elif event_type == "error":
            cursor.execute(
                "UPDATE agent_runs SET status='failed', error_code=%s, completed_at=UTC_TIMESTAMP() WHERE id=%s",
                (str(payload.get("code") or "AGENT_ERROR")[:100], run_id),
            )
            cursor.execute(
                """INSERT INTO ai_usage_events (trace_id, user_id, provider, model, feature, success, error_code)
                   SELECT trace_id, user_id, provider, model, 'agent_chat', FALSE, %s FROM agent_runs WHERE id=%s""",
                (str(payload.get("code") or "AGENT_ERROR")[:100], run_id),
            )


def record_pause(run_id: str, user_id: str, requirements: list[Any]) -> list[dict[str, Any]]:
    visible: list[dict[str, Any]] = []
    with transaction() as (_, cursor):
        cursor.execute(
            "UPDATE agent_runs SET status='awaiting_approval' WHERE id=%s AND user_id=%s",
            (run_id, user_id),
        )
        if cursor.rowcount != 1:
            raise PermissionError("The paused run does not belong to this user")

        for index, requirement in enumerate(requirements):
            execution = getattr(requirement, "tool_execution", None)
            requirement_id = str(getattr(requirement, "requirement_id", "") or f"requirement-{index}")
            tool_name = str(getattr(execution, "tool_name", "tool"))
            arguments = getattr(execution, "tool_args", {}) or {}
            execution_id = stable_id("tool", f"{run_id}:{requirement_id}")
            approval_id = stable_id("approval", f"{run_id}:{requirement_id}")
            prompt = f"Allow {tool_name} with the displayed arguments?"
            cursor.execute(
                """INSERT INTO tool_executions
                   (id, run_id, tool_id, risk_level, arguments_json, status)
                   VALUES (%s, %s, %s, 'sensitive', %s, 'pending')
                   ON DUPLICATE KEY UPDATE arguments_json=VALUES(arguments_json)""",
                (execution_id, run_id, tool_name, json.dumps(arguments, default=str)),
            )
            cursor.execute(
                """INSERT INTO approval_requests
                   (id, run_id, tool_execution_id, requirement_id, user_id, prompt, status, expires_at)
                   VALUES (%s, %s, %s, %s, %s, %s, 'pending', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))
                   ON DUPLICATE KEY UPDATE prompt=VALUES(prompt)""",
                (approval_id, run_id, execution_id, requirement_id, user_id, prompt),
            )
            visible.append({
                "id": approval_id,
                "requirementId": requirement_id,
                "tool": tool_name,
                "arguments": arguments,
                "expiresInSeconds": 1800,
            })
        cursor.execute(
            "INSERT INTO agent_events (run_id, event_type, payload) VALUES (%s, 'approval.required', %s)",
            (run_id, json.dumps({"requirements": visible}, default=str)),
        )
    return visible


def resolve_approval(run_id: str, user_id: str, approved: bool, note: str | None = None) -> dict[str, Any]:
    with transaction() as (_, cursor):
        cursor.execute(
            """SELECT ar.conversation_id, ar.provider, ar.allow_built_in_fallback, ar.context_item_ids
               FROM agent_runs ar WHERE ar.id=%s AND ar.user_id=%s FOR UPDATE""",
            (run_id, user_id),
        )
        run = cursor.fetchone()
        if not run:
            raise PermissionError("Run not found")
        cursor.execute(
            """SELECT id, tool_execution_id FROM approval_requests
               WHERE run_id=%s AND user_id=%s AND status='pending' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
               FOR UPDATE""",
            (run_id, user_id),
        )
        approvals = cursor.fetchall()
        if not approvals:
            raise RuntimeError("This approval was already decided or expired")
        status = "approved" if approved else "denied"
        tool_status = "approved" if approved else "denied"
        cursor.execute(
            """UPDATE approval_requests SET status=%s, decision_note=%s, decided_at=UTC_TIMESTAMP()
               WHERE run_id=%s AND user_id=%s AND status='pending'""",
            (status, (note or "")[:2000] or None, run_id, user_id),
        )
        execution_ids = [row["tool_execution_id"] for row in approvals]
        placeholders = ",".join(["%s"] * len(execution_ids))
        cursor.execute(
            f"UPDATE tool_executions SET status=%s, completed_at=IF(%s='denied', UTC_TIMESTAMP(), completed_at) WHERE id IN ({placeholders})",
            (tool_status, tool_status, *execution_ids),
        )
        cursor.execute(
            "UPDATE agent_runs SET status='running' WHERE id=%s",
            (run_id,),
        )
        cursor.execute(
            """INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata)
               VALUES (%s, %s, 'agent_run', %s, %s)""",
            (user_id, "agent.approval.approved" if approved else "agent.approval.denied", run_id, json.dumps({"note": note})),
        )
        return dict(run)


def mark_resume_failed(run_id: str, code: str) -> None:
    with transaction() as (_, cursor):
        cursor.execute(
            "UPDATE agent_runs SET status='failed', error_code=%s, completed_at=UTC_TIMESTAMP() WHERE id=%s",
            (code[:100], run_id),
        )


def expire_approvals() -> int:
    with transaction() as (_, cursor):
        cursor.execute(
            """UPDATE approval_requests SET status='expired', decided_at=UTC_TIMESTAMP()
               WHERE status='pending' AND expires_at IS NOT NULL AND expires_at <= UTC_TIMESTAMP()"""
        )
        return int(cursor.rowcount)


def epoch_seconds() -> int:
    return int(time.time())


def probe_database() -> bool:
    connection = _connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 AS ok")
            return bool(cursor.fetchone())
    finally:
        connection.close()
