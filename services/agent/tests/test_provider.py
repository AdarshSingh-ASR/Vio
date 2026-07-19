import pytest

import app.provider as provider


class FakeModel:
    def __init__(self, id: str, **kwargs):
        self.id = id
        self.kwargs = kwargs
        self.retries = kwargs.get("retries")
        self.exponential_backoff = kwargs.get("exponential_backoff")


def test_byok_never_falls_back_without_explicit_consent(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(provider, "_openai_model", lambda model_id, api_key=None: FakeModel(model_id, api_key=api_key))
    selection = provider.select_provider("openai_byok", "sk-private", False)
    assert selection.provider == "openai"
    assert selection.fallback_config is None
    assert selection.model.kwargs["api_key"] == "sk-private"


def test_byok_requires_a_user_credential():
    with pytest.raises(ValueError):
        provider.select_provider("openai_byok", None, False)


def test_capabilities_publish_the_billing_boundary(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "project")
    snapshot = provider.capability_snapshot()
    assert snapshot["primary"] == "vertex"
    assert "billing_boundary" in snapshot["non_fallback_errors"]
    assert snapshot["providers"]["vertex"]["tools"] is True


def test_actual_fallback_provider_is_normalized():
    assert provider.normalize_provider("Groq", "llama-3.3", "vertex") == "groq"
    assert provider.normalize_provider("OpenAI", "gpt-5.6", "vertex") == "openai"


def test_built_in_fallback_order_is_vertex_then_openai_groq_openrouter(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("OPENAI_API_KEY", "built-in-openai")
    monkeypatch.setenv("GROQ_API_KEY", "built-in-groq")
    monkeypatch.setenv("OPENROUTER_API_KEY", "router-key")
    monkeypatch.setenv("OPENROUTER_MODELS", "router/first,router/second")
    monkeypatch.setattr(provider, "_vertex_model", lambda model_id: FakeModel(model_id))
    monkeypatch.setattr(provider, "_openai_model", lambda model_id, api_key=None: FakeModel(model_id, api_key=api_key))
    monkeypatch.setattr(provider, "_groq_model", lambda model_id: FakeModel(model_id))
    monkeypatch.setattr(provider, "_openrouter_model", lambda model_id, api_key: FakeModel(model_id, api_key=api_key))
    monkeypatch.setattr(provider, "_fallback_config", lambda **kwargs: kwargs)

    selection = provider.built_in_selection()

    assert selection.provider == "vertex"
    assert selection.model.id == "gemini-2.5-flash"
    assert [model.id for model in selection.fallback_config["on_error"]] == [
        "gpt-5.6", "llama-3.3-70b-versatile", "router/first", "router/second"
    ]
    assert selection.fallback_config["on_rate_limit"] == selection.fallback_config["on_error"]


def test_byok_crosses_to_built_in_only_with_explicit_consent(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(provider, "_openai_model", lambda model_id, api_key=None: FakeModel(model_id, api_key=api_key))
    monkeypatch.setattr(provider, "built_in_selection", lambda: provider.ProviderSelection(FakeModel("gemini-2.5-flash"), None, "vertex", "gemini-2.5-flash"))
    monkeypatch.setattr(provider, "_fallback_config", lambda **kwargs: kwargs)

    selection = provider.select_provider("openai_byok", "sk-private", True)

    assert [model.id for model in selection.fallback_config["on_error"]] == ["gemini-2.5-flash"]
