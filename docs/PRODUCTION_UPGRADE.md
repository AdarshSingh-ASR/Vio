# Production Upgrade Report

## Resolution inventory

| Existing issue | Resolution | Status |
|---|---|---|
| Scattered direct model calls | Shared Next.js compatibility client and Agno provider service; existing generation routes now use it | Implemented |
| No provider policy | Vertex primary, retry-classified OpenAI/Groq fallback, BYOK boundary, optional OpenRouter | Implemented |
| Agents were isolated prompts | Typed Agno tools, ACL-checked BFF calls, approval pause, SSE events | Implemented |
| No durable chat memory | Conversation/message schema, Agno MySQL sessions, summaries, curated-memory storage | Implemented |
| Client-supplied file context | Selected files are resolved by an ownership-checked internal tool | Implemented |
| Non-streaming markdown chat | SSE and Streamdown with tool/approval/error states | Implemented |
| Runtime/ad-hoc DDL | Numbered checksum migrations and migration ledger | Implemented |
| Broad default file permissions | Public defaults removed; authenticated uploads use scoped Appwrite clients | Implemented |
| No classroom workflow | Membership, invites, homework, versioned submissions, evaluation, review, override, publication | Implemented |
| Learning Studio Vercel blockers | Routes, UI, services, types, native dependencies, binaries, and configuration removed | Implemented |
| Placeholder memory module | TiDB-backed memory CRUD/retrieval plus agent sessions/summaries | Implemented |
| Incomplete document support | Asynchronous PDF, DOCX, PPTX, spreadsheet, text, image OCR, and media ingestion with chunk locators and Vertex embeddings | Implemented |
| No automated protection | Unit, type, lint, production-build, real-service integration, Playwright, axe, and k6 gates added | Implemented; live staging execution pending |
| Cookie-presence middleware | Sensitive endpoints now verify Appwrite JWT server-side and resolve TiDB identity | Implemented at API boundary; middleware remains navigation-only |
| Dependency risk | Removed unused renderer/editor/agent dependency trees, upgraded Next/React, replaced SheetJS, and pinned patched PostCSS | Implemented; production npm audit reports zero advisories |

The hardening pass also upgraded the web runtime to Next.js 16.2.10 and React 19.2.4, migrated asynchronous route parameters and the `proxy` convention, removed unused dependency trees, and replaced the vulnerable SheetJS parser with a constrained XLSX/ZIP reader.

## Major code areas

- `migrations/`: AI, conversation, memory, classroom, audit, and reversible Learning Studio archive schema.
- `services/agent/`: Agno runtime, provider adapters, tools, evaluation, persistence, and signed request validation.
- `src/lib/central-ai.ts`: compatibility entry point used by existing generation routes.
- `src/lib/conversation-service.ts`: conversation persistence and legacy chat migration path.
- `src/lib/classroom-service.ts`: classroom authorization and state transitions.
- `src/lib/classroom-file-processing.ts`: extraction and knowledge ingestion.
- `src/app/api/internal/agent/tools/`: constrained, authorization-rechecked tool surface.
- `src/components/global/info-bar/CustomChatSidebar.tsx`: streaming chat UX.
- `src/app/dashboard/classrooms/`: teacher and student workflows.
- `src/components/settings/AIProviderSettings.tsx`: built-in and OpenAI BYOK provider settings.

Generate the exact changed-file list from version control at release time:

```bash
git status --short
git diff --name-status
```

## Database migration and rollback

1. Snapshot TiDB and export Appwrite object metadata.
2. Run `npm run migrate:tidb` in staging.
3. Confirm `schema_migrations` checksums and `video_generations_archive` count.
4. Run classroom/auth smoke tests before serving traffic.

Migrations are forward-only because MySQL/TiDB DDL is not transactionally reversible in the same way as application writes. Rollback means restoring the verified snapshot and deploying the previous application. Do not edit an applied SQL file. The Learning Studio migration itself preserves source rows as JSON before dropping the source table.

## Production gates

- Empty-database and representative upgrade migration tests against the target TiDB version.
- Cross-user/classroom authorization E2E suite against Appwrite sandbox resources.
- KMS encrypt/decrypt/rotate/revoke integration tests.
- Cloud Tasks retry and idempotency tests.
- Provider outage, rate-limit, malformed output, and billing-boundary tests.
- Browser tests for streaming reconnect, approval resume, resubmission, late submission, and publication visibility.
- Dependency advisory review with explicit upgrades or accepted-risk records.
- Load, accessibility, and cost evaluation in staging.

## Remaining production verification

- Run the live infrastructure suite against the intended TiDB, Appwrite, KMS, Cloud Tasks, and Vertex project.
- Run the real teacher/student Playwright workflow and accessibility suite in staging.
- Execute migration 011 and the real Vertex embedding backfill for pre-existing documents.
- Run the authenticated k6 profile and record capacity/cost limits.
- Complete the final security review and promote only after every gate in `docs/TESTING.md` passes.
