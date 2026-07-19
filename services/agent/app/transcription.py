import os
from typing import Awaitable, Callable


def _retryable(error: Exception) -> bool:
    status = getattr(error, "status_code", None) or getattr(error, "code", None)
    if status in {408, 429, 500, 502, 503, 504, 529}:
        return True
    name = type(error).__name__.lower()
    return any(token in name for token in ("timeout", "connection", "ratelimit", "serviceunavailable"))


async def _vertex(data: bytes, mime_type: str) -> tuple[str, str, str]:
    from google import genai
    from google.genai import types

    model = os.getenv("VERTEX_MODEL", "gemini-2.5-flash")
    client = genai.Client(
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
    response = await client.aio.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=data, mime_type=mime_type),
            "Transcribe all intelligible speech faithfully. Include speaker labels when clear. Return transcript text only.",
        ],
    )
    return str(response.text or ""), "vertex", model


async def _openai(data: bytes, file_name: str) -> tuple[str, str, str]:
    from openai import AsyncOpenAI

    model = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")
    result = await AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"]).audio.transcriptions.create(
        model=model,
        file=(file_name, data),
    )
    return str(result.text), "openai", model


async def _groq(data: bytes, file_name: str) -> tuple[str, str, str]:
    from groq import AsyncGroq

    model = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo")
    result = await AsyncGroq(api_key=os.environ["GROQ_API_KEY"]).audio.transcriptions.create(
        model=model,
        file=(file_name, data),
    )
    return str(result.text), "groq", model


async def transcribe_media(data: bytes, mime_type: str, file_name: str) -> tuple[str, str, str]:
    providers: list[Callable[[], Awaitable[tuple[str, str, str]]]] = [lambda: _vertex(data, mime_type)]
    if os.getenv("OPENAI_API_KEY"):
        providers.append(lambda: _openai(data, file_name))
    if os.getenv("GROQ_API_KEY"):
        providers.append(lambda: _groq(data, file_name))
    first_error: Exception | None = None
    for index, provider in enumerate(providers):
        try:
            transcript = await provider()
            if not transcript[0].strip():
                raise RuntimeError("The transcription provider returned no text")
            return transcript
        except Exception as error:
            first_error = first_error or error
            if index == 0 and not _retryable(error):
                raise
    raise first_error or RuntimeError("No transcription provider is configured")
