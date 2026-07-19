import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProviderSelection:
    model: object
    fallback_config: object | None
    provider: str
    model_id: str


@dataclass(frozen=True)
class ProviderCapabilities:
    text: bool = True
    multimodal: bool = True
    structured_output: bool = True
    tools: bool = True
    streaming: bool = True


def _fallback_activated(primary: str, fallback: str, error: Exception) -> None:
    # Never include prompts, credentials, or raw provider responses in logs.
    print({"event": "ai.fallback", "primary": primary, "fallback": fallback, "error_code": type(error).__name__})


def _retryable(model: object) -> object:
    setattr(model, "retries", 2)
    setattr(model, "exponential_backoff", True)
    return model


def _fallback_config(**kwargs: Any) -> object:
    from agno.models.fallback import FallbackConfig

    return FallbackConfig(**kwargs)


def _vertex_model(model_id: str) -> object:
    from agno.models.google import Gemini

    return Gemini(
        id=model_id,
        vertexai=True,
        project_id=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        retries=2,
        exponential_backoff=True,
    )


def _openai_model(model_id: str, api_key: str | None = None) -> object:
    from agno.models.openai import OpenAIResponses

    return OpenAIResponses(id=model_id, api_key=api_key, retries=2, exponential_backoff=True)


def _groq_model(model_id: str) -> object:
    from agno.models.groq import Groq

    return _retryable(Groq(id=model_id))


def _openrouter_model(model_id: str, api_key: str) -> object:
    from agno.models.openrouter import OpenRouter

    return _retryable(OpenRouter(id=model_id, api_key=api_key))


def built_in_selection() -> ProviderSelection:
    model_id = os.getenv("VERTEX_MODEL", "gemini-2.5-flash")
    primary = _vertex_model(model_id)
    fallbacks: list[object] = []
    if os.getenv("OPENAI_API_KEY"):
        fallbacks.append(_openai_model(os.getenv("OPENAI_MODEL", "gpt-5.6")))
    if os.getenv("GROQ_API_KEY"):
        fallbacks.append(_groq_model(os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")))
    openrouter_models = [item.strip() for item in os.getenv("OPENROUTER_MODELS", os.getenv("OPENROUTER_MODEL", "")).split(",") if item.strip()]
    if os.getenv("OPENROUTER_API_KEY"):
        for openrouter_model in openrouter_models:
            fallbacks.append(_openrouter_model(openrouter_model, os.environ["OPENROUTER_API_KEY"]))
    config = _fallback_config(on_error=fallbacks, on_rate_limit=fallbacks, callback=_fallback_activated) if fallbacks else None
    return ProviderSelection(primary, config, "vertex", model_id)


def select_provider(mode: str, user_openai_key: str | None, allow_built_in_fallback: bool) -> ProviderSelection:
    if mode != "openai_byok":
        return built_in_selection()
    if not user_openai_key:
        raise ValueError("OpenAI BYOK was selected without a credential")
    model_id = os.getenv("OPENAI_MODEL", "gpt-5.6")
    primary = _openai_model(model_id, user_openai_key)
    fallback = None
    if allow_built_in_fallback:
        built_in = built_in_selection()
        fallback = _fallback_config(on_error=[built_in.model], on_rate_limit=[built_in.model], callback=_fallback_activated)
    return ProviderSelection(primary, fallback, "openai", model_id)


def capability_snapshot() -> dict[str, Any]:
    common = ProviderCapabilities().__dict__
    return {
        "primary": "vertex",
        "providers": {
            "vertex": {"configured": bool(os.getenv("GOOGLE_CLOUD_PROJECT")), "model": os.getenv("VERTEX_MODEL", "gemini-2.5-flash"), **common},
            "openai": {"configured": bool(os.getenv("OPENAI_API_KEY")), "model": os.getenv("OPENAI_MODEL", "gpt-5.6"), **common},
            "groq": {"configured": bool(os.getenv("GROQ_API_KEY")), "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), **common},
            "openrouter": {"configured": bool(os.getenv("OPENROUTER_API_KEY") and (os.getenv("OPENROUTER_MODELS") or os.getenv("OPENROUTER_MODEL"))), "models": os.getenv("OPENROUTER_MODELS", os.getenv("OPENROUTER_MODEL", "")).split(","), **common},
        },
        "fallback_policy": ["rate_limit", "timeout", "retryable_provider_error"],
        "non_fallback_errors": ["safety_rejection", "invalid_input", "authorization", "billing_boundary"],
    }


def normalize_provider(value: str | None, model_id: str | None, default: str) -> str:
    combined = f"{value or ''} {model_id or ''}".lower()
    if "openrouter" in combined:
        return "openrouter"
    if "groq" in combined or "llama" in combined:
        return "groq"
    if "openai" in combined or "gpt" in combined or "o3" in combined or "o4" in combined:
        return "openai"
    if "google" in combined or "gemini" in combined or "vertex" in combined:
        return "vertex"
    return default
