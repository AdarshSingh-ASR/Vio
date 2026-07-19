# Production verification

Vio's live suites do not substitute mock databases, fake AI responses, seeded evaluation results, or bypassed authentication.

## Local static gates

```bash
npm ci
npm run lint
npm run type-check
npm test
npm run build
cd services/agent
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m ruff check app tests
python -m mypy app --no-incremental
```

## Live infrastructure gate

Set the production or isolated staging TiDB, Appwrite, KMS, Cloud Tasks, and private agent environment variables. Then run:

```bash
npm run test:integration:live
```

This performs real connectivity and policy checks, including a KMS encrypt/decrypt round trip. Use a staging KMS key when validating a staging release.

## Live teacher/student E2E and accessibility gate

Install the browser once:

```bash
npx playwright install chromium
```

Provide `E2E_BASE_URL`, `E2E_TEACHER_EMAIL`, `E2E_TEACHER_PASSWORD`, `E2E_STUDENT_EMAIL`, and `E2E_STUDENT_PASSWORD`, then run:

```bash
npm run test:e2e:live
```

The classroom test creates a real classroom and invite, joins with a second real account, publishes homework, submits work, waits for a real AI evaluation, publishes a teacher review, and verifies the student result. The accessibility test runs axe against public application pages.

## Live load gate

Install k6 and provide a fresh Appwrite JWT for a dedicated load-test account:

```bash
k6 run -e E2E_BASE_URL=https://YOUR_DEPLOYMENT -e E2E_APPWRITE_JWT=JWT tests/load/chat.js
```

The default threshold requires less than 1% failed requests and a 95th-percentile response time below ten seconds for authenticated history reads. Add a separately approved streaming-chat scenario before a high-volume test because it consumes real model quota.

## Embedding backfill

After migration `011_vector_retrieval.sql`, existing extracted documents are intentionally marked for backfill. With the real agent and Vertex credentials configured, run:

```bash
npm run backfill:embeddings
```

The command records per-document failures and never generates placeholder vectors.

## Release gate

A production promotion requires all static gates plus live infrastructure, classroom E2E, authorization, migration, accessibility, and credential-security checks. A missing secret or skipped live suite is an unverified gate, not a pass.
