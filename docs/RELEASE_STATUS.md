# Release status — 2026-07-19

## Implemented

The repository implementation in `docs/PRODUCTION_UPGRADE.md` is complete at code level: Learning Script Studio removal, numbered migrations, centralized Vertex/OpenAI/Groq/OpenRouter providers, encrypted OpenAI BYOK, the Agno agent and typed tools, persistent/scoped memory, hybrid retrieval and file processing, Streamdown streaming chat, classroom management, human-reviewed AI grading, observability, security boundaries, live test harnesses, and one-control-plane Google Cloud deployment automation.

Codex runtime/account integration is intentionally absent. Migration 007 removes its historical credential/preferences schema, matching the project's locked runtime decision.

## Verified locally

These gates passed from a clean `npm ci` installation:

- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm run lint`: passed with 0 warnings/errors.
- `npm run type-check`: passed.
- `npm test`: 9 files, 21 tests passed.
- `npm run build`: passed on Next.js 16.2.10; 39 static pages generated and all dynamic routes compiled.
- Agent `pytest`: 8 tests passed.
- Agent Ruff: passed.
- Agent mypy: passed for all 9 source files.
- `cloudbuild.yaml`: parsed successfully with 9 steps.
- `git diff --check`: passed after whitespace cleanup.

## External release gates

The following are implemented as executable harnesses but cannot be truthfully marked passed on this workstation because no staging URLs/accounts, Google Cloud credentials, `gcloud`, or Docker engine are available:

- Real TiDB migration/vector validation.
- Appwrite bucket-policy and cross-account authorization checks.
- KMS round trip, Cloud Tasks, private agent readiness, and real Vertex embedding checks.
- Teacher/student classroom and real file-processing Playwright suites.
- Authenticated accessibility and k6 load tests.
- Cloud Run image build/deployment, canary, rollback exercise, and production smoke test.
- Real embedding backfill for existing production documents.

Run `docs/TESTING.md` against staging, then follow `docs/DEPLOYMENT.md`. Missing credentials are an unverified release gate, never a synthetic pass.
