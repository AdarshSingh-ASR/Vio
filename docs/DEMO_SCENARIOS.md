# Demonstration Scenarios

## Typed tool calling

Prompt: `Show my Biology classroom and tell me which assignment is due next.`

Expected events: `list_classrooms` starts/completes, then `get_classroom` receives the returned classroom UUID. The answer names only authorized data and includes no invented homework.

## Persistent memory

In session one say: `I prefer 25-minute study blocks and concise checklists.` In a new session ask: `Plan tonight's revision.` The agent uses the durable preference while current explicit instructions override it. Verify the fact in `user_memories`/Agno memory and the session summary in persistence.

## File processing and citations

Attach a PDF, PPTX, DOCX, spreadsheet, or image, then ask a fact-specific question. The agent calls `get_selected_documents`, uses `[F1]`-style source labels, and does not use another user's material. The UI shows extraction state and source/tool events.

## Multi-step classroom workflow

1. Teacher creates a classroom and invite.
2. Student joins and submits text plus a file.
3. The immutable version triggers an evaluation task.
4. Teacher opens the exact answer/file, compares the AI draft, changes marks with a reason, and saves a draft.
5. Student still sees only `waiting for teacher`.
6. Teacher publishes; student sees authoritative marks, remarks, improvements, and clearly labeled AI feedback.

## Failure recovery

Temporarily reject the first provider or internal tool call. Retryable Vertex failures move to OpenAI/Groq; a tool 5xx returns a structured recoverable result and the agent explains a safe retry. Invalid input, denial, or BYOK billing failures must not cross the provider boundary.

## Sensitive-action confirmation

Prompt a teacher agent: `Publish Sam's review with 82 marks and the remarks already drafted.` The `publish_teacher_review` tool pauses with exact arguments. Rejecting makes no mutation; approving publishes and writes an audit event.

## Hackathon recording

Keep the public demo under three minutes: problem (15s), teacher creates evidence-grounded work (35s), student multimodal submission (30s), AI evaluation and citations (35s), teacher override/publication (35s), agent tool/approval/memory (20s), deliberate failure recovery and architecture proof (10s). Record with real teacher/student accounts, real uploads, and visible processing states; do not substitute seeded or mocked AI results.
