# Research Workflow Migration Plan

This document describes how to move `research` from a job-driven pipeline into a workflow-first pipeline with explicit steps.

Use it as the implementation guide for the refactor. The goal is to make research behave like the rest of the platform: one workflow run, ordered steps, visible progress, step logs, and a single place to inspect failures.

## Current State

Research currently works like this:

1. `POST /api/research/{topicId}/runs` creates a root job with type `research.topic.run`.
2. The worker creates `research_topic_runs` as the durable run record.
3. The root job enqueues child jobs for search, fetch, normalize, rank, and synthesize.
4. Research state is stored across:
   - `research_topic_runs`
   - `research_topic_run_phases`
   - `research_search_runs`
   - `research_search_results`
   - `research_content_runs`
   - `research_content_items`
   - `research_ranking_runs`
   - `research_ranked_documents`
   - `research_synthesis_runs`

This is functional, but it mixes two orchestration models:

- `jobs` as execution units
- `research_*` tables as workflow state

The result is inconsistent with transcript insights, where a workflow is the visible top-level object.

## Target State

Research should become workflow-first:

- one research workflow per user-initiated or scheduled run
- one workflow run record for the top-level execution
- ordered workflow steps for each phase
- jobs used only as the execution mechanism underneath the workflow
- admin UI shows the workflow, its steps, and step-level logs

The canonical model should be:

`workflow -> steps -> job execution -> logs/results`

## Design Principles

1. `Workflow` is the domain object the user understands.
2. `Job` is the background execution primitive.
3. Each research phase must be visible as a workflow step.
4. Step state must be recoverable from the database.
5. Logging must be step-aware and searchable.
6. The admin surface should show workflow state first, job details second.

## Proposed Research Workflow Steps

The research workflow should be broken into these steps:

1. `plan`
2. `search`
3. `fetch`
4. `normalize`
5. `rank`
6. `synthesize`
7. `persist`

### Step responsibilities

#### `plan`

- Build source-aware queries from the topic name, description, tags, and frequency.
- Decide which sources are eligible for the run.
- Store the planner version and planning metadata.

#### `search`

- Execute source adapters and collect candidate links/snippets.
- Persist raw search runs and raw search results.
- Keep source-level failures isolated from the rest of the workflow.

#### `fetch`

- Fetch raw content for selected URLs.
- Store fetch metadata and content acquisition state.

#### `normalize`

- Clean the fetched content.
- Remove duplicates.
- Convert raw content into normalized documents or segments.

#### `rank`

- Rank candidate content for relevance and freshness.
- Persist ranking output and scores.

#### `synthesize`

- Build the final briefing payload from ranked evidence.
- Call the LLM only with normalized, curated inputs.

#### `persist`

- Save the final briefing and update topic state.
- Mark the workflow succeeded only after persistence completes.

## State Model

### Workflow statuses

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### Step statuses

- `queued`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `retrying`

### Transition rules

- Creating a research run creates a workflow in `queued`.
- Step 1 moves the workflow to `running`.
- Each step updates independently.
- The workflow becomes `succeeded` only after `persist`.
- The workflow becomes `failed` when a non-retryable step fails.
- Retry attempts should remain localized to the current step.

## Data Model

The migration should introduce or formalize a research workflow layer.

### Recommended core tables

#### `workflows`

Use this as the top-level run record for research.

Recommended columns:

- `id`
- `workflow_type`
- `requested_by_user_id`
- `source_id`
- `status`
- `current_step_key`
- `input_json`
- `result_json`
- `error_code`
- `error_message`
- `attempt_count`
- `max_attempts`
- `progress_percent`
- `progress_message`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

#### `workflow_steps`

One row per workflow step.

Recommended columns:

- `id`
- `workflow_id`
- `step_order`
- `step_key`
- `step_type`
- `job_id`
- `status`
- `input_json`
- `output_json`
- `error_code`
- `error_message`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

### Research-specific supporting tables

The existing research tables can be kept as supporting detail tables, but they should no longer drive orchestration.

- `research_topic_runs`
- `research_topic_run_phases`
- `research_search_runs`
- `research_search_results`
- `research_content_runs`
- `research_content_items`
- `research_ranking_runs`
- `research_ranked_documents`
- `research_synthesis_runs`

Recommended rule:

- workflow tables own the control plane
- research tables own durable domain artifacts and debugging detail

## Migration Phases

### Phase 1: Introduce workflow-first research model

Goal:

- create a research workflow record when a run starts
- keep existing jobs working while the new workflow record is added

Tasks:

- add a research workflow type for top-level runs
- add step records for each research phase
- map the current root job to workflow creation
- keep current jobs for execution underneath the workflow

### Phase 2: Move orchestration to workflow steps

Goal:

- the workflow becomes the source of truth for progress and state
- jobs become implementation detail for each step

Tasks:

- convert `research.topic.run` into a workflow step runner
- create step-specific job payloads for search/fetch/normalize/rank/synthesize
- update step state as each job starts, succeeds, or fails

### Phase 3: Consolidate observability

Goal:

- admin can inspect workflow, steps, jobs, and logs in one place

Tasks:

- show research workflows in the admin `Workflows` area
- show each workflow step and linked job id
- show step logs and job logs side by side
- expose the current running step and failure reason clearly

### Phase 4: Reduce duplicate state

Goal:

- remove unnecessary overlap between workflow state and research tables

Tasks:

- decide which `research_*` tables remain as durable artifacts
- stop using `research_topic_runs` as the orchestration source if workflow state fully covers it
- keep only the tables needed for analytics, debugging, and briefing reconstruction

## API Changes

The research API should expose workflow-centric views.

Recommended additions:

- list research workflows for a topic
- get workflow by id
- list steps for a research workflow
- list step logs by step job id
- list job logs by job id

Recommended behavior:

- `POST /api/research/{topicId}/runs` should return the workflow id
- run history should be keyed by workflow id
- step details should be readable from the admin UI without joining unrelated tables manually

## Worker Changes

The worker should execute research as a workflow runner:

- create workflow record
- create step record
- enqueue or run the step job
- write step progress
- write logs for each step
- advance to the next step only after the current step succeeds

Important rule:

- the worker should never leave the UI guessing which phase a run is in

## Admin UI Changes

The admin surface should show:

1. workflows
2. jobs
3. workflow steps
4. job logs

For research runs, the admin should be able to see:

- workflow id
- topic id
- current step
- step history
- linked job ids
- raw logs
- final result
- failure reason

## Implementation Order

Recommended order:

1. Add the research workflow data model.
2. Add workflow step persistence.
3. Make `research.topic.run` create a workflow run.
4. Move `search`, `fetch`, `normalize`, `rank`, and `synthesize` behind workflow steps.
5. Update admin screens to display research workflows first.
6. Remove duplicate orchestration state if it becomes redundant.

## Non-Goals

This refactor should not try to redesign the research product at the same time.

Do not change yet:

- research query planning semantics
- search provider selection rules
- content fetching logic
- ranking heuristics
- briefing generation prompt behavior

Those can stay as-is while the orchestration model changes.

## Outcome

When this migration is complete:

- research will be a real workflow
- steps will be explicit and debuggable
- jobs will still exist, but only as execution units
- admin will see one coherent process instead of mixed models

