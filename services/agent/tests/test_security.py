import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException

from app.security import require_agent_context


def token(secret: str, claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{payload}.{signature}"


@pytest.mark.asyncio
async def test_context_token_is_scoped(monkeypatch: pytest.MonkeyPatch):
    secret = "test-agent-secret-with-enough-entropy"
    monkeypatch.setenv("AGENT_SHARED_SECRET", secret)
    value = token(secret, {"sub": "user-1", "permissions": ["documents:read"], "run_id": "run-1", "conversation_id": "conversation-1", "exp": int(time.time()) + 60})
    context = await require_agent_context(value)
    assert context.user_id == "user-1"
    assert context.permissions == ("documents:read",)
    assert context.run_id == "run-1"
    assert context.conversation_id == "conversation-1"


@pytest.mark.asyncio
async def test_expired_context_token_is_rejected(monkeypatch: pytest.MonkeyPatch):
    secret = "test-agent-secret-with-enough-entropy"
    monkeypatch.setenv("AGENT_SHARED_SECRET", secret)
    value = token(secret, {"sub": "user-1", "exp": int(time.time()) - 1})
    with pytest.raises(HTTPException) as error:
        await require_agent_context(value)
    assert error.value.status_code == 401
