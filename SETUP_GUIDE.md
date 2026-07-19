# Setup Guide

## Prerequisites

- Node.js 20.9+
- Python 3.11+
- TiDB/MySQL-compatible database
- Appwrite project with server API access and file buckets
- Google Cloud project with Vertex AI; Cloud KMS and Cloud Tasks for production
- Docker for local container parity

## Application

```bash
cp env.example .env.local
npm ci
npm run setup:tidb
npm run dev
```

`setup:tidb` creates the legacy baseline tables for a new development database, then applies all numbered migrations. For an existing installation, take a snapshot and run `npm run migrate:tidb`.

## Agent service

```bash
cd services/agent
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

Set `AGNO_DATABASE_URL`, `AGENT_SHARED_SECRET`, `VIO_INTERNAL_API_URL`, and the provider variables from `env.example`. For Vertex on a workstation, use Application Default Credentials. Cloud Run should use Workload Identity.

## Credential encryption

Production requires `KMS_KEY_NAME`. Grant only the web service identity encrypt/decrypt access to that key. For local development only, create a 32-byte base64 value for `AI_CREDENTIAL_ENCRYPTION_KEY`.

## Cloud Tasks

Create the queue and configure:

- `CLOUD_TASKS_PROJECT`
- `CLOUD_TASKS_LOCATION`
- `CLOUD_TASKS_QUEUE`
- `CLOUD_TASKS_INGESTION_QUEUE`
- `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL`
- `VIO_JOB_CALLBACK_URL`

Development can invoke homework evaluation directly when a queue is absent. Production file ingestion deliberately refuses a synchronous fallback because OCR, extraction, transcription, and embedding do not belong in an interactive web request.

## Vector retrieval

New files are embedded with `VERTEX_EMBEDDING_MODEL` after extraction and stored in TiDB `VECTOR(768)` columns. After upgrading an existing database through migration 011, run `npm run backfill:embeddings` with the real agent service and Vertex identity configured.

## Verification

```bash
npm run type-check
npm test
npm run lint
npm run build
python -m compileall services/agent/app
```

The unit suite does not require live provider credentials. Follow [docs/TESTING.md](docs/TESTING.md) for mandatory live infrastructure, teacher/student, accessibility, and load gates. Missing live configuration is not considered a pass.
