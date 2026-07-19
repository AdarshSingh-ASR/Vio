import os
from typing import Any

import httpx
from agno.tools import tool


def build_tools(agent_token: str, selected_item_ids: list[str] | None = None, trace_id: str | None = None):
    async def call_tool(name: str, payload: dict[str, Any], retryable: bool = False) -> dict[str, Any]:
        base = os.environ["VIO_INTERNAL_API_URL"].rstrip("/")
        attempts = 2 if retryable else 1
        async with httpx.AsyncClient(timeout=httpx.Timeout(15, connect=5)) as client:
            for attempt in range(attempts):
                try:
                    response = await client.post(
                        f"{base}/api/internal/agent/tools/{name}",
                        headers={"X-Vio-Agent-Token": agent_token, **({"X-Vio-Trace-Id": trace_id} if trace_id else {})},
                        json=payload,
                    )
                except (httpx.ConnectError, httpx.ReadTimeout):
                    if attempt + 1 == attempts:
                        return {"ok": False, "recoverable": True, "error": "The Vio tool service could not be reached."}
                    continue
                if response.status_code < 500 or attempt + 1 == attempts:
                    break
        if response.status_code >= 500:
            return {"ok": False, "recoverable": True, "error": "The Vio tool service is temporarily unavailable."}
        if response.status_code >= 400:
            try:
                detail = response.json().get("error", "Tool request was rejected.")
            except (ValueError, AttributeError):
                detail = "Tool request was rejected."
            return {"ok": False, "recoverable": False, "error": detail}
        return {"ok": True, "data": response.json()}

    @tool(name="search_documents", cache_results=True, cache_ttl=60)
    async def search_documents(query: str, limit: int = 5) -> dict[str, Any]:
        """Search the signed-in user's saved documents. Use this before answering questions about their files. Limit must be 1-10."""
        return await call_tool("search-documents", {"query": query, "limit": max(1, min(limit, 10))}, retryable=True)

    @tool(name="get_selected_documents", cache_results=True, cache_ttl=60)
    async def get_selected_documents() -> dict[str, Any]:
        """Read the files the user explicitly attached to this chat message. Use this before answering about attached or selected files."""
        if not selected_item_ids:
            return {"ok": True, "data": {"results": []}}
        return await call_tool("get-selected-documents", {"itemIds": selected_item_ids[:10]}, retryable=True)

    @tool(name="list_classrooms", cache_results=True, cache_ttl=30)
    async def list_classrooms() -> dict[str, Any]:
        """List classrooms the signed-in user can access, including whether they are a teacher or student."""
        return await call_tool("list-classrooms", {}, retryable=True)

    @tool(name="get_classroom", cache_results=True, cache_ttl=30)
    async def get_classroom(classroom_id: str) -> dict[str, Any]:
        """Get an accessible classroom with its members and homework. Use the exact classroom ID returned by list_classrooms."""
        return await call_tool("get-classroom", {"classroomId": classroom_id}, retryable=True)

    @tool(name="publish_teacher_review", requires_confirmation=True)
    async def publish_teacher_review(classroom_id: str, submission_id: str, marks: float, remarks: str, improvements: str = "", override_reason: str = "") -> dict[str, Any]:
        """Publish a final teacher review. This is sensitive and always requires explicit confirmation. Never infer marks without the teacher providing or approving them."""
        return await call_tool("publish-teacher-review", {"classroomId": classroom_id, "submissionId": submission_id, "marks": marks, "remarks": remarks, "improvements": improvements, "overrideReason": override_reason})

    @tool(name="remember_user_preference")
    async def remember_user_preference(key: str, content: str) -> dict[str, Any]:
        """Store a durable user preference only when the user explicitly asks Vio to remember it. Use a stable short key such as 'explanation_style'. Never store credentials, grades, private classroom records, or inferred sensitive facts."""
        return await call_tool("remember-memory", {"key": key[:255], "content": content[:2000]})

    @tool(name="list_learning_paths", cache_results=True, cache_ttl=30)
    async def list_learning_paths(limit: int = 10) -> dict[str, Any]:
        """List the signed-in user's saved learning paths and current progress. Limit must be 1-20."""
        return await call_tool("list-learning-paths", {"limit": max(1, min(limit, 20))}, retryable=True)

    @tool(name="get_learning_path", cache_results=True, cache_ttl=30)
    async def get_learning_path(path_id: str) -> dict[str, Any]:
        """Get one owned learning path and its ordered steps. Use an exact path ID returned by list_learning_paths."""
        return await call_tool("get-learning-path", {"pathId": path_id}, retryable=True)

    @tool(name="list_study_sessions", cache_results=True, cache_ttl=30)
    async def list_study_sessions(limit: int = 10) -> dict[str, Any]:
        """List recent study sessions, statuses, and saved performance metrics for the signed-in user."""
        return await call_tool("list-study-sessions", {"limit": max(1, min(limit, 20))}, retryable=True)

    @tool(name="list_research_history", cache_results=True, cache_ttl=30)
    async def list_research_history(limit: int = 10) -> dict[str, Any]:
        """List recent owned research queries, generated summaries, and confidence metadata."""
        return await call_tool("list-research", {"limit": max(1, min(limit, 20))}, retryable=True)

    @tool(name="list_assignment_submissions", cache_results=True, cache_ttl=15)
    async def list_assignment_submissions(classroom_id: str, assignment_id: str) -> dict[str, Any]:
        """For a teacher, list every student and whether they submitted an assignment, including timestamps and evaluation state. IDs must come from classroom tools."""
        return await call_tool("list-assignment-submissions", {"classroomId": classroom_id, "assignmentId": assignment_id}, retryable=True)

    @tool(name="create_draft_assignment")
    async def create_draft_assignment(classroom_id: str, title: str, instructions: str, due_at: str, max_marks: float = 100, lesson_number: str = "", chapter_number: str = "", chapter_name: str = "") -> dict[str, Any]:
        """Create an unpublished homework draft for a classroom the user teaches. due_at must be an ISO-8601 UTC timestamp. This never publishes the homework."""
        return await call_tool("create-draft-assignment", {"classroomId": classroom_id, "title": title, "instructions": instructions, "dueAt": due_at, "maxMarks": max_marks, "lessonNumber": lesson_number or None, "chapterNumber": chapter_number or None, "chapterName": chapter_name or None})

    @tool(name="publish_assignment", requires_confirmation=True)
    async def publish_assignment(classroom_id: str, assignment_id: str, confirm_after_submissions: bool = False) -> dict[str, Any]:
        """Publish a homework assignment to students. This is sensitive and always requires explicit confirmation. Set confirm_after_submissions only when the user explicitly accepts changing an assignment that already has submissions."""
        return await call_tool("publish-assignment", {"classroomId": classroom_id, "assignmentId": assignment_id, "confirmAfterSubmissions": confirm_after_submissions})

    @tool(name="close_assignment", requires_confirmation=True)
    async def close_assignment(classroom_id: str, assignment_id: str, confirm_after_submissions: bool = False) -> dict[str, Any]:
        """Close a published homework assignment. This is sensitive and requires confirmation. Set confirm_after_submissions only after the teacher explicitly accepts the impact on existing submissions."""
        return await call_tool("close-assignment", {"classroomId": classroom_id, "assignmentId": assignment_id, "confirmAfterSubmissions": confirm_after_submissions})

    @tool(name="revoke_classroom_invite", requires_confirmation=True)
    async def revoke_classroom_invite(classroom_id: str, invite_id: str) -> dict[str, Any]:
        """Revoke an active classroom invite returned by get_classroom. This is sensitive and always requires the teacher's confirmation."""
        return await call_tool("revoke-classroom-invite", {"classroomId": classroom_id, "inviteId": invite_id})

    @tool(name="remove_classroom_member", requires_confirmation=True)
    async def remove_classroom_member(classroom_id: str, member_user_id: str) -> dict[str, Any]:
        """Remove a student from a classroom. This is sensitive, cannot remove the owner, and always requires explicit confirmation with the named student."""
        return await call_tool("remove-classroom-member", {"classroomId": classroom_id, "memberUserId": member_user_id})

    @tool(name="archive_classroom", requires_confirmation=True)
    async def archive_classroom(classroom_id: str) -> dict[str, Any]:
        """Archive a classroom and hide it from active classroom lists. This is sensitive and always requires explicit teacher confirmation."""
        return await call_tool("archive-classroom", {"classroomId": classroom_id})

    tools = [
        search_documents, list_classrooms, get_classroom, publish_teacher_review, remember_user_preference,
        list_learning_paths, get_learning_path, list_study_sessions, list_research_history,
        list_assignment_submissions, create_draft_assignment, publish_assignment, close_assignment,
        revoke_classroom_invite, remove_classroom_member, archive_classroom,
    ]
    if selected_item_ids:
        tools.insert(0, get_selected_documents)
    return tools
