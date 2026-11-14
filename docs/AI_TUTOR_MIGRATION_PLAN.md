# AI Tutor Dashboard Migration Plan

## Goal

Replace the current Whiteboard-first learning experience with a reliable, topic-and-material-focused AI Tutor dashboard. The selected layout is **B**: conversation in the centre, session history and uploaded material in a left sidebar, and existing study tools available from the workspace.

## Guardrails

- Work on `feature/ai-tutor-dashboard`; do not make unreviewed changes directly to `main`.
- Keep the existing Whiteboard and its route available until the replacement is functional and tested.
- Reuse StudySmartly's existing authenticated AI server functions, provider fallback, Zod validation, and shared daily usage controls.
- Never send AI-generated executable code to the browser. Treat uploaded files as untrusted source material.
- Do not claim image understanding until image data is actually sent to a vision-capable model.
- Do not claim video understanding until the lecture has been transcribed and the transcript is available as conversation context.
- Keep the app free to students; avoid paid dependencies and services.
- Limit request size and attachment processing to protect mobile performance and AI quota.
- Preserve existing Flashcards, Exam Arena, Transcriber, Planner and Presentation Studio functionality.

## Phases and acceptance criteria

### Phase 0 — Foundation and audit
- Create this feature branch and record the migration plan.
- Inspect the current Tutor, app store, source-file reader, AI server functions, navigation and persistence.
- Identify which features can be reused and which gaps need new work.

**Exit:** a safe working branch exists and the current implementation is understood.

### Phase 1 — Tutor dashboard shell
- Build the selected three-area workspace: history/materials sidebar, central conversation, study-tools access.
- Make the layout responsive; on narrow screens, side content must be accessible without squeezing the chat.
- Keep the existing Tutor data and Whiteboard route intact while the new shell is developed.
- Include clear empty, loading and error states.

**Exit:** dashboard navigation and layout work on mobile and desktop with no regression to existing routes.

### Phase 2 — Authenticated AI conversation
- Replace the legacy direct-client Socratic API path with a server-side Tutor function.
- Reuse the existing AI provider waterfall, authentication middleware, schema validation and usage accounting.
- Validate conversation history and prompt sizes; return serializable success/error results.
- Support direct explanations as well as guided, step-by-step teaching.

**Exit:** authenticated text chat works through the existing quota/provider infrastructure.

### Phase 3 — Source attachments
- Support images, PDFs and text-based documents using the existing source reader where appropriate.
- Ensure image content is included in the model request, not merely described as an attachment.
- Add attachment count/size limits and clear processing feedback.
- Avoid sending every rendered PDF page by default when doing so would create oversized requests.

**Exit:** supported attachments are genuinely available to the model and oversized inputs fail safely.

### Phase 4 — Video lecture workflow
- Locate and audit the existing Lecture Transcriber implementation.
- Reuse its transcription output as Tutor source context rather than building a second transcription engine.
- Clearly explain that the AI is answering from the transcript and any supported visual frames, not necessarily the entire raw video.

**Exit:** a lecture transcript can be attached to a conversation and referenced in follow-up questions.

### Phase 5 — Persistence and account isolation
- Audit existing Supabase tables and RLS before creating any schema.
- Move conversation persistence to authenticated, user-scoped storage only after schema and migration review.
- Keep browser storage as a deliberate cache/draft layer, not the only long-term record.
- Do not store large base64 attachment payloads in chat rows; use a suitable storage/reference strategy if available.

**Exit:** users can retrieve their own saved conversations across sessions and cannot access another user's data.

### Phase 6 — Study tool integration
- Add entry points to existing Flashcards, Exam Arena, Presentation Studio, Planner and Transcriber.
- Pass selected conversation sources into tools through existing typed source formats where feasible.
- Avoid duplicating tool implementations or silently spending AI quota on background generation.

**Exit:** tools open reliably and use only the source material the student chooses.

### Phase 7 — Verification and transition
- Run lint, type-check/build and available tests.
- Test mobile/desktop layout, sign-in, provider fallback, quota handling, attachments, saved history and existing feature routes.
- Keep Whiteboard available until acceptance criteria pass; then propose a separate, reversible navigation transition.

**Exit:** verified replacement is ready for review. No automatic deletion of the old Whiteboard.

## Current audit findings

- `src/components/study/Tutor.tsx` is an existing basic chat, but its AI path uses `@/lib/socratic` rather than the shared learning-AI server pipeline.
- The current Tutor image path adds an "[Image attached]" text marker to the model prompt; it does not pass the image data to the model.
- `src/components/learning/SourcePicker.tsx` and `src/lib/source-files.ts` already support images, PDFs, TXT, Markdown and CSV. PDFs are rendered page-by-page and currently capped at 50 pages, which needs more careful request-size handling for chat.
- `src/lib/learning-ai.server.ts` contains the shared authenticated AI provider waterfall and daily usage accounting.
- `src/store.tsx` currently persists Tutor sessions through browser storage. This is not cross-device account persistence.
- `src/types.ts` currently defines simple `ChatMessage` and `TutorSession` types, including one optional image field.
- `src/components/learning/Whiteboard.tsx` remains a separate lazy-loaded feature and must not be removed during the initial migration.
- The repository already has React, Tailwind, Lucide, and AI SDK dependencies. Do not add a chat framework until its value and compatibility are confirmed.

## Status

- [x] Phase 0: branch created and initial audit recorded.
- [~] Phase 1: dashboard shell implemented; build and responsive QA still pending.
- [ ] Phase 2: shared authenticated AI chat.
- [ ] Phase 3: image/PDF/text attachments.
- [ ] Phase 4: video lecture context.
- [ ] Phase 5: cross-device saved conversations.
- [ ] Phase 6: study-tool integration.
- [ ] Phase 7: verification and transition.
