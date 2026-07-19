import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException


@dataclass(frozen=True)
class AgentContext:
    user_id: str
    permissions: tuple[str, ...]
    run_id: str | None = None
    conversation_id: str | None = None
    trace_id: str | None = None


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


async def require_agent_context(x_vio_agent_token: str = Header(...)) -> AgentContext:
    try:
        payload, signature = x_vio_agent_token.split(".", 1)
        secret = os.environ["AGENT_SHARED_SECRET"].encode()
        expected = base64.urlsafe_b64encode(hmac.new(secret, payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        claims = json.loads(_decode(payload))
        if int(claims["exp"]) < int(time.time()):
            raise ValueError("expired")
        return AgentContext(
            str(claims["sub"]),
            tuple(claims.get("permissions", [])),
            str(claims["run_id"]) if claims.get("run_id") else None,
            str(claims["conversation_id"]) if claims.get("conversation_id") else None,
            str(claims["trace_id"]) if claims.get("trace_id") else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid internal agent token") from exc
