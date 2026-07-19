# Vio

Vio is an AI-assisted education workspace for learning material, grounded chat, study workflows, quizzes, and human-reviewed classroom homework.

## What is implemented

- Next.js 16 and React 19 browser application and authenticated BFF.
- Appwrite authentication and permission-scoped binary storage.
- TiDB relational storage with numbered, checksum-verified migrations.
- Agno/FastAPI agent service on Cloud Run.
- Vertex AI Gemini 2.5 Flash as the built-in primary provider, with retryable OpenAI and Groq fallbacks.
- User-funded OpenAI Platform keys with KMS envelope encryption.
- Streaming SSE chat with Streamdown, typed tool events, citations, approvals, stop/retry, and durable sessions.
- ACL-filtered hybrid lexical/vector retrieval with Vertex embeddings, file extraction, grounded citations, conversation summaries, and curated memory storage.
- Classroom creation, invitations, assignments, attachments, immutable submission versions, AI evaluation, teacher override, and explicit result publication.

Learning Script Studio and its FFmpeg/Manim rendering stack have been removed. Legacy generation records are archived and verified by migration before their source table is dropped.

## Quick start

1. Copy `env.example` to `.env.local` and fill the Appwrite, TiDB, provider, and internal-service values.
2. Install dependencies with `npm ci`.
3. Initialize or upgrade the database with `npm run setup:tidb`.
4. Start the agent service from `services/agent`.
5. Run `npm run dev`.

Before shipping, run:

```bash
npm run type-check
npm test
npm run lint
npm run build
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md), [ARCHITECTURE.md](ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), [production verification](docs/TESTING.md), and the [release status](docs/RELEASE_STATUS.md) for complete configuration and operations.

## Deployment

The recommended release uses one Cloud Build submission to deploy the web service, private agent, migration job, and queues in one Google Cloud control plane. The Next.js service remains Vercel-compatible as an optional split topology. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security boundaries

- The browser never receives decrypted AI credentials.
- User-funded AI usage accepts validated OpenAI Platform API keys.
- Agent tools receive short-lived signed context and recheck authorization in the Next.js BFF.
- Grade publication and other sensitive tools require explicit approval.
- Draft AI grading is hidden from students until a teacher publishes an authoritative review.

## Demo

Use [docs/DEMO_SCENARIOS.md](docs/DEMO_SCENARIOS.md) for reproducible demonstrations using real accounts, uploads, provider responses, memory, tool approvals, and teacher-in-the-loop grading.
