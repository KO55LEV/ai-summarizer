# Transcript Page Plan

Internal working plan for the analyzed-transcript page. This is the checklist we will use while implementing the page, not a user-facing doc.

## Scope

Page surface:
- Main transcript view after a transcript already exists.
- Right sidebar insight actions.
- Generated insight output display.
- Paid workflow state and billing UX.

## Current State

Already done:
- Transcript fetch and display for completed videos.
- Transcript right sidebar with insight buttons.
- Prompt seeds for the LLM-backed actions.
- Backend API to launch insight workflows by `sourceId` and `actionKey`.
- Workflow execution for:
  - `quick-summary`
  - `key-takeaways`
  - `ask-this-video`
  - `study-guide`
- Prompt run audit storage.
- Billing reserve / settle / release for insight workflows.
- UI polling for running insight workflows.
- Sidebar launcher/status card for insight actions.
- Quick Summary now renders in the main transcript view with tabbed insight UI.
- Ask this video now uses an inline mini-chat with short context and excerpt-based prompting.
- Chapters now render from transcript-derived deterministic grouping.
- Key Quotes now render as transcript-derived quote cards.
- Study Guide now renders overview, terms, flashcards, and quiz cards.
- Billing balance is loaded for the transcript page and paid actions now require an explicit cost confirmation step.
- Insight history is available per transcript source, and saved results can be reopened without rerunning the workflow.

Still incomplete:
- Nothing blocking for the transcript page plan.

## Phase 1: Quick Summary First-Class UI

Goal:
- Make `Quick Summary` feel like the primary action on this page.

Tasks:
- Render the generated summary in the main content area, not only in the sidebar.
- Add a dedicated summary panel with:
  - title
  - one-sentence summary
  - bullets
  - confidence or quality indicator
- Keep the sidebar for action selection and status.
- Make loading/succeeded/failed states visually obvious.

Exit criteria:
- Clicking `Quick Summary` produces a visible, polished summary section in the page body.

## Phase 2: Ask This Video UX

Goal:
- Replace the temporary question prompt with a proper page interaction.

Tasks:
- Add an inline question composer for `Ask this video`.
- Support a clear submit / cancel flow.
- Show the estimated cost before submission.
- Keep the answer output structured in the sidebar or main panel.
- Decide whether questions should be stored per workflow or handled as ephemeral input.

Exit criteria:
- The user can ask a question without browser prompt UI.

## Phase 3: Chapters And Quotes

Goal:
- Remove the remaining mocked content and make the transcript page feel complete.

Tasks:
- Replace mocked `Chapters` content with real chapter generation.
- Decide whether `Chapters` is:
  - a deterministic transcript split, or
  - an LLM-assisted structure, or
  - a hybrid model.
- Add `Key Quotes` as a real insight or transcript-derived block.
- Render quote cards with timestamps and short context.
- Decide whether quotes should be generated synchronously or lazily.

Exit criteria:
- Chapters and quotes are both backed by real data, not placeholder text.

## Phase 4: Study Guide Polish

Goal:
- Make study-oriented outputs feel intentionally designed.

Tasks:
- Expand Study Guide rendering beyond minimal counts.
- Show flashcards as cards, not raw JSON.
- Show quiz questions with answer state and explanations.
- Add a compact review summary at the top.
- Decide which parts are generated once versus revealed progressively.

Exit criteria:
- Study Guide reads as a usable learning output, not a raw model response.

## Phase 5: Billing UX

Goal:
- Make cost visible and understandable before a paid action runs.

Tasks:
- Show estimated credits before execution.
- Add a confirmation step for paid actions.
- Show wallet / balance / remaining credits if available in the app.
- Make insufficient-funds errors explicit and recoverable.
- Consider a reusable paid-action banner or modal for all insight actions.

Exit criteria:
- The user understands that the action is paid before pressing the final confirm button.

## Phase 6: Result History And Reopen

Goal:
- Make generated insights reusable after creation.

Tasks:
- Persist generated insight outputs in a way the page can reopen later.
- Add a visible history or tabs for previous outputs on the same transcript.
- Allow switching between summary, takeaways, quotes, guide, and Q&A without regenerating.
- Decide whether this history belongs on the transcript page, in a separate insights page, or both.

Exit criteria:
- Users can revisit prior outputs without rerunning the workflow.

## Phase Checklist

- [x] Phase 1: Quick Summary first-class UI
- [x] Phase 2: Ask This Video UX
- [x] Phase 3: Chapters and Quotes
- [x] Phase 4: Study Guide polish
- [x] Phase 5: Billing UX
- [x] Phase 6: Result history and reopen

## Files To Watch

- `ui/src/components/TranscriptRightSidebar.tsx`
- `ui/src/components/BackendTranscriptView.tsx`
- `ui/src/App.tsx`
- `src/AiSummarizer.Api/Transcripts/TranscriptsController.cs`
- `src/AiSummarizer.Application/Transcripts/TranscriptInsightsService.cs`
- `src/AiSummarizer.Worker/Workflows/WorkflowProcessorHostedService.cs`
