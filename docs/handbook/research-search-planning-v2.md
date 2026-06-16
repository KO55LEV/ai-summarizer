# Research Search Planning v2

This document describes the next iteration of the research pipeline.
The goal is to separate topic understanding from search execution so the system can reuse a cached plan and avoid calling the LLM on every run.

## Goal

Convert research into a two-stage flow:

1. Plan the search once from `title + intent`.
2. Execute the stored search plan on every run.

The planning stage must produce structured search directives that are used by all search sources:

- web
- news
- archive
- reddit
- financial
- twitter
- youtube

If planning cannot be completed because the LLM is unavailable or returns an invalid result, the research workflow must fail fast with a clear error.

## Core Rules

- `save/edit` should update the cached search plan.
- `run` should never build search terms from raw title/intent directly if a valid plan already exists.
- If no valid plan exists at run time, workflow step zero must create it.
- If the LLM is unavailable during planning, the workflow fails.
- Planning should happen once per topic update, not once per run.

## Data Model

Use a dedicated table to store the reusable planning output.

### Suggested table: `research_topic_search_plans`

Recommended columns:

- `id`
- `research_topic_id`
- `plan_version`
- `prompt_key`
- `prompt_version`
- `provider`
- `model`
- `status`
- `plan_json`
- `input_hash`
- `source_hash`
- `generated_at`
- `created_at`
- `updated_at`
- `error_code`
- `error_message`

### Suggested status values

- `pending`
- `ready`
- `stale`
- `failed`

### Status rules

- `pending` means planning was requested and is not finished yet.
- `ready` means the cached plan can be used for execution.
- `stale` means the topic changed after the last valid plan.
- `failed` means planning failed and the cached plan cannot be used.

## Planned JSON Shape

The LLM should return compact, structured JSON. Suggested shape:

```json
{
  "topic_summary": "short summary of the user intent",
  "language": "en",
  "entities": ["person", "brand", "product"],
  "keywords": ["short", "normalised", "search", "terms"],
  "source_plans": [
    {
      "source": "youtube",
      "queries": ["short query 1", "short query 2"],
      "exclude_terms": ["irrelevant", "noise"],
      "recency": "week"
    }
  ]
}
```

The exact schema can be adjusted, but it should remain:

- short
- deterministic
- source-aware
- easy to validate

## Workflow

### Save/Edit topic

1. User edits research topic title, intent, sources, or tags.
2. Backend marks the previous plan as `stale`.
3. Backend schedules a planning job.
4. Planning job calls the LLM.
5. If the call succeeds, the plan is stored as `ready`.
6. If the call fails, the plan is stored as `failed`.

### Run research

1. Workflow starts.
2. Step zero checks the cached plan.
3. If a `ready` plan exists, use it.
4. If no `ready` plan exists, create or reuse a planning job.
5. If planning succeeds, continue into search execution.
6. If planning fails or the LLM is unavailable, fail the workflow.

## Phases

### Phase 0: Search Planning

Purpose:

- turn the topic title and intent into short search directives
- normalize language and recency hints
- produce source-specific queries

Inputs:

- topic title
- topic intent
- selected sources
- topic tags
- topic frequency

Outputs:

- cached plan JSON
- source-specific queries
- plan version and model metadata

Failure behavior:

- if the LLM request fails, the workflow fails
- no fallback to raw title/intent search

### Phase 1: Search Intake

Purpose:

- run source adapters using the cached plan
- collect search results

Inputs:

- cached search plan
- selected sources

Outputs:

- raw search results
- per-source run records

### Phase 2: Content Acquisition

Purpose:

- fetch the content behind the discovered links

### Phase 3: Normalization

Purpose:

- clean and standardize fetched content

### Phase 4: Ranking

Purpose:

- score and select the most useful documents

### Phase 5: Synthesis

Purpose:

- generate the final briefing with the prompt from Prompt Management

### Phase 6: Persistence

Purpose:

- store briefing, sections, sources, and run metadata

## Prompt Management

Add a dedicated prompt for planning.

Suggested prompt key:

- `research.search.plan`

Suggested responsibilities:

- infer intent from topic title and description
- produce compact source-specific search queries
- keep output valid JSON only
- avoid long natural-language output

The workflow must read this prompt from the database, not from hardcoded strings.

## Failure Policy

If planning cannot be completed:

- mark the planning step as failed
- mark the workflow as failed
- persist an error code such as `prompt_not_found`, `prompt_inactive`, or `llm_unavailable`
- do not continue to search execution

## Implementation Checklist

### Data

- [ ] Add `research_topic_search_plans` table
- [ ] Store plan status and version metadata
- [ ] Store the raw JSON plan

### Prompting

- [ ] Add `research.search.plan` prompt to Prompt Management
- [ ] Seed the prompt in the database
- [ ] Add a mock prompt entry for local UI/dev data

### Workflow

- [ ] Add planning as workflow step zero
- [ ] Fail the workflow if the planning LLM is unavailable
- [ ] Reuse an existing ready plan when available
- [ ] Mark plans stale on topic save/edit

### Search execution

- [ ] Change query builder to consume plan JSON
- [ ] Stop building search strings directly from raw topic text
- [ ] Keep source adapters source-specific only

### Observability

- [ ] Log prompt key, provider, and model for planning
- [ ] Log generated search plan JSON
- [ ] Log request and response metadata for planning failures
- [ ] Surface planning status in admin workflow views

## Open Questions

- Should the cached plan live in a new table or in JSON columns on `research_topics`?
- Should `save/edit` enqueue planning synchronously or as a background job?
- Should run step zero wait for a pending plan, or fail immediately if one is already in progress?

## Recommendation

Use a new table for the search plan.
Keep `save/edit` asynchronous.
Let `run` reuse a ready plan, or create step zero if no plan exists.
Treat LLM unavailability as a hard failure.
