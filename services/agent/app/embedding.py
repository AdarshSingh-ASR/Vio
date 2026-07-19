import os

EMBEDDING_DIMENSIONS = 768


async def embed_texts(texts: list[str], task_type: str) -> tuple[list[list[float]], str]:
    """Create real Vertex embeddings using Application Default Credentials."""
    from google import genai
    from google.genai import types

    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is not configured")
    model = os.getenv("VERTEX_EMBEDDING_MODEL", "gemini-embedding-001")
    client = genai.Client(
        vertexai=True,
        project=project,
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        http_options=types.HttpOptions(api_version="v1"),
    )
    vectors: list[list[float]] = []
    for text in texts:
        response = await client.aio.models.embed_content(
            model=model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIMENSIONS,
                auto_truncate=True,
            ),
        )
        if not response.embeddings or not response.embeddings[0].values:
            raise RuntimeError("Vertex returned no embedding")
        vector = [float(value) for value in response.embeddings[0].values]
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise RuntimeError(f"Vertex returned {len(vector)} dimensions; expected {EMBEDDING_DIMENSIONS}")
        vectors.append(vector)
    return vectors, model
