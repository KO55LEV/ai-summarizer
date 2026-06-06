# Research Search Implementation Plan

This document is the working plan for the research search pipeline in `AiSummarizer`.
Use it to track what is already implemented, what still needs to be added, and where new changes belong.

## Goal

Build a research pipeline that:

- takes a `research_topic_id`
- runs source-specific search adapters
- fetches and stores raw page/content data
- normalizes and ranks the data
- sends curated context to the LLM
- generates and persists the final briefing
- remains easy to extend with new sources and providers

## Architecture Summary

The pipeline should be layered:

1. Search intake
2. Content acquisition
3. Normalization
4. Ranking and selection
5. LLM synthesis
6. Persistence
7. Scheduling and retries

The design rule is:

- UI and API should only describe the intent and selected sources
- search adapters should only discover candidate links and metadata
- fetchers should retrieve raw content
- LLM should only see cleaned, normalized context

## Run and Phase Status Model

The pipeline should use a parent run plus child phase records.

### Parent run statuses

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### Phase statuses

- `queued`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `retrying`

### Lifecycle rules

- `research.topic.run` creates the parent execution.
- The parent run is created in `queued`.
- When phase 1 starts, the run becomes `running`.
- Each phase updates its own row independently.
- The run becomes `succeeded` only after the final briefing is persisted.
- The run becomes `failed` if a non-retryable phase fails.
- Retries should only transition the current phase to `retrying`.

### Phase keys

- `search_intake`
- `content_acquisition`
- `normalization`
- `ranking`
- `synthesis`
- `persistence`

---

## Phase 1: Search Intake

### Purpose

Find candidate links and source metadata for the topic.

### Inputs

- `research_topic_id`
- `topic name`
- `description`
- `tags`
- selected `sources`
- `frequency`

### Outputs

- search queries per source
- raw search results
- source-level metadata

### Work to implement

- Add or finalize a `ResearchWorkflow` job payload that carries `research_topic_id`.
- Add a scheduler that finds topics where `next_run_at <= now`.
- Add a `SearchQueryPlanner` that generates queries per source.
- Add source adapters:
  - `web`
  - `news`
  - `archive`
  - `reddit`
  - `financial`
  - `twitter`
  - `youtube`
- Keep search results as links/snippets only at this stage.

### Database changes

- Reuse `research_topic_sources.source_key` for new keys.
- Add a table for raw search results if we want durable replay and debugging.
- Suggested new tables:
  - `research_topic_runs`
  - `research_topic_run_phases`
  - `research_search_runs`
  - `research_search_results`

### Suggested run tables

#### `research_topic_runs`

One row per topic execution.

Recommended columns:

- `id`
- `research_topic_id`
- `requested_by_user_id`
- `job_id`
- `status`
- `triggered_by`
- `started_at`
- `finished_at`
- `next_retry_at`
- `error_code`
- `error_message`
- `summary_preview`
- `created_at`
- `updated_at`

#### `research_topic_run_phases`

One row per phase within a run.

Recommended columns:

- `id`
- `research_topic_run_id`
- `phase_key`
- `status`
- `attempt_count`
- `started_at`
- `finished_at`
- `error_code`
- `error_message`
- `metrics_json`
- `created_at`
- `updated_at`

### Suggested search tables

#### `research_search_runs`

One row per source execution inside a topic run.

Recommended columns:

- `id`
- `research_topic_run_id`
- `research_topic_run_phase_id`
- `research_topic_id`
- `source_key`
- `planner_version`
- `query_count`
- `status`
- `started_at`
- `finished_at`
- `error_code`
- `error_message`
- `metrics_json`
- `created_at`
- `updated_at`

#### `research_search_results`

One row per candidate result returned by a source search.

Recommended columns:

- `id`
- `research_search_run_id`
- `research_topic_run_id`
- `research_topic_id`
- `source_key`
- `query`
- `title`
- `url`
- `canonical_url`
- `snippet`
- `score`
- `published_at`
- `author_name`
- `domain`
- `language`
- `result_rank`
- `raw_result_json`
- `created_at`
- `updated_at`

### Suggested execution metadata

If we want clean replay and observability, also keep these fields on the run rows or in JSON metadata:

- effective time window used by the planner
- forced source list if the run was overridden
- search provider name and version
- planner hash
- idempotency key
- parent scheduler tick time
- retry count

### API changes

- Add endpoint to trigger research run manually.
- Add endpoint to inspect search sources and search run status.
- Add endpoint to inspect raw search results for a topic or run.

### Job/workflow changes

- Add job type for research execution: `research.topic.run`.
- Make it the parent orchestration job for the whole pipeline.
- Add retry boundaries around the search phase.

### Notes

- Search should not perform crawling yet.
- Search should be source-aware, not generic.

---

## Phase 2: Content Acquisition

### Purpose

Fetch the full raw content for the links returned by search.

### Inputs

- raw search result URLs
- source type
- crawl policy

### Outputs

- full page text
- transcript text for YouTube
- structured metadata
- fetch status and error details

### Work to implement

- Add content fetchers per source type.
- For regular web pages:
  - HTTP fetch first
  - Playwright fallback for JS-heavy pages
- For YouTube:
  - separate workflow or job path to download/transcribe
- For Reddit:
  - prefer structured post/comment retrieval when possible
- For financial sources:
  - fetch filings, market pages, or API responses
- For Twitter/X:
  - fetch post/thread metadata and content
- For archive:
  - fetch archived page content

### Database changes

- Add a durable store for fetched raw content.
- Suggested tables:
  - `research_content_runs`
  - `research_content_items`
  - `research_content_assets`
- Store:
  - raw text
  - canonical URL
  - fetch method
  - content hash
  - timestamps
  - file/blob path if content is too large for a single row

### Suggested content tables

#### `research_content_runs`

One row per acquisition pass over a search run or a subset of search results.

Recommended columns:

- `id`
- `research_topic_run_id`
- `research_search_run_id`
- `research_topic_id`
- `status`
- `started_at`
- `finished_at`
- `error_code`
- `error_message`
- `metrics_json`
- `created_at`
- `updated_at`

#### `research_content_items`

One row per fetched page, transcript, or document.

Recommended columns:

- `id`
- `research_content_run_id`
- `research_topic_run_id`
- `research_topic_id`
- `source_key`
- `source_url`
- `canonical_url`
- `title`
- `author_name`
- `published_at`
- `fetched_at`
- `fetch_method`
- `content_type`
- `content_hash`
- `raw_text`
- `raw_text_storage_path`
- `raw_metadata_json`
- `status`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

#### `research_content_assets`

Optional child table for large files or binary artifacts.

Recommended columns:

- `id`
- `research_content_item_id`
- `asset_type`
- `storage_path`
- `mime_type`
- `size_bytes`
- `checksum`
- `created_at`
- `updated_at`

### API changes

- Add API to inspect fetched content for a run.
- Add API to retrieve a single fetched item.

### Job/workflow changes

- Add a content acquisition job step after search.
- YouTube should be its own job path or nested workflow.
- If we keep everything inside one parent job, phase 2 should still emit child jobs or subtasks for YouTube transcript acquisition and Playwright-heavy pages.

### Notes

- This phase should produce raw data, not final LLM-ready context.
- For large content, prefer file/blob storage plus DB references.
- Playwright fallback is still deferred; current delivery uses HTTP fetch for web pages and yt-dlp subtitle extraction for YouTube.

---

## Phase 3: Normalization

### Purpose

Convert raw content from different sources into a common internal format.

### Outputs

- normalized document records
- chunks or sections if the content is large
- source provenance
- timestamps
- canonical hashes

### Work to implement

- Normalize all content into a single document shape.
- Strip boilerplate, nav, and duplicate fragments.
- Keep source provenance attached to every chunk.
- Normalize publication time, author, domain, and source type.

### Database changes

- Add normalized document tables if needed.
- Suggested tables:
  - `research_documents`
  - `research_document_chunks`

### Suggested document tables

#### `research_documents`

One row per normalized source document.

Recommended columns:

- `id`
- `research_content_item_id`
- `research_topic_run_id`
- `research_topic_id`
- `source_key`
- `canonical_url`
- `title`
- `author_name`
- `published_at`
- `normalized_at`
- `canonical_body`
- `canonical_hash`
- `raw_content_hash`
- `source_provenance_json`
- `normalizer_version`
- `created_at`
- `updated_at`

#### `research_document_chunks`

One row per chunk or section derived from a normalized document.

Recommended columns:

- `id`
- `research_document_id`
- `chunk_index`
- `chunk_title`
- `chunk_text`
- `token_count`
- `start_offset`
- `end_offset`
- `chunk_hash`
- `chunk_metadata_json`
- `created_at`
- `updated_at`

### API changes

- Add read-only inspection endpoints for normalized documents and chunks.
- Support `GET /api/research/runs/{runId}/documents`.
- Support `GET /api/research/documents/{documentId}/chunks`.

### Job/workflow changes

- Add normalization as a distinct step so it can be retried independently.

### Notes

- This is where Playwright/HTML extraction results become stable content.
- This phase should not call the LLM yet.
- Store a normalized canonical body and keep a raw content reference separately.

---

## Phase 4: Ranking and Selection

### Purpose

Choose the best context items for synthesis.

### Inputs

- normalized documents
- source weights
- freshness window
- topic importance
- query relevance

### Outputs

- selected items
- ranked items
- grouped evidence by source

### Work to implement

- Add a scorer/ranker.
- Add source-specific trust weights.
- Add freshness weighting.
- Add dedupe rules by URL/hash/title similarity.
- Add per-source quotas so one source does not dominate the result set.
- Persist ranking decisions so synthesis can be replayed later.

### Database changes

- Add persistence for ranked snapshots if we want replay/debugging.
- Suggested tables:
  - `research_ranking_runs`
  - `research_ranked_documents`

### API changes

- Add read-only inspection endpoints for ranking runs and ranked documents.

### Job/workflow changes

- Add ranking as a separate step from normalization.
- Add job type `research.topic.rank`.

### Notes

- The LLM should only see ranked, filtered content.
- Ranking should not mutate the raw records.
- Store ranking decisions with score breakdowns so later phases can inspect them.

---

## Phase 5: LLM Synthesis

### Purpose

Convert selected evidence into the final research briefing.

### Inputs

- selected normalized documents
- topic metadata
- prompt template

### Outputs

- summary
- sections
- sources
- preview text
- final structured briefing payload

### Work to implement

- Add a synthesis service that builds the LLM request.
- Choose reasoning provider via the existing `ReasoningAI` layer.
- Store provider, model, request, response, and token usage.
- Persist the parsed briefing payload and link it to the run.

### Database changes

- Extend or reuse prompt run storage if needed for research synthesis.
- Add briefing execution log table if we want full auditability.
- Suggested tables:
  - `research_synthesis_runs`

### Suggested synthesis tables

#### `research_synthesis_runs`

One row per synthesis attempt.

Recommended columns:

- `id`
- `research_topic_run_id`
- `research_topic_id`
- `status`
- `reasoning_provider`
- `model`
- `input_hash`
- `prompt_version`
- `request_json`
- `response_json`
- `usage_json`
- `started_at`
- `finished_at`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

### API changes

- Add endpoint to re-run synthesis for a given topic or run.
- Add endpoint to inspect synthesis input/output.
- Add read-only inspection endpoints for synthesis runs.

### Job/workflow changes

- Add a synthesis step after ranking.
- Keep synthesis retryable independently from search and crawl.
- Persist the synthesis input hash or snapshot id so the briefing can be reproduced later.
- Add job type `research.topic.synthesize`.
- The synthesis handler may also finalize briefing persistence to keep the pipeline linear.

### Notes

- Synthesis should not perform search or crawling.
- It should only consume the already prepared context.
- Final briefing persistence should only happen after synthesis succeeds.
- The LLM output must be strict JSON. If the provider returns malformed JSON:
  - inspect `research_synthesis_runs.response_json`
  - inspect the raw provider payload in `response_json`
  - tighten the prompt or switch `prompt_version`
  - rerun synthesis for the same `research_topic_run_id`

---

## Phase 6: Persistence and Reporting

### Purpose

Store the final result and the execution history.

### Work to implement

- Save the final briefing.
- Save execution timestamps.
- Save failure reason and step status if the workflow fails.
- Update `last_run_at`, `next_run_at`, and preview text.
- Save link back to the run, search results, and content items.

### Database changes

- Reuse `research_briefings`.
- Add workflow/run history tables if we need better auditability.

### API changes

- Add read endpoints for:
  - workflow status
  - run history
  - raw search results
  - raw fetched content

### Job/workflow changes

- Mark completion only when briefing persistence succeeds.
- Update parent run and phase rows in the same transaction when possible.

### Notes

- If the workflow fails, we should know at which phase it failed.

---

## Phase 7: Scheduling and Expansion Hooks

### Purpose

Make the system easy to extend without touching every layer.

### Work to implement

- Keep a registry-based source adapter model.
- Keep a separate content fetcher interface.
- Keep ranking independent from source fetching.
- Keep synthesis independent from crawling/search.
- Make new sources easy to register with one adapter class.

### Database changes

- No schema change should be required for a new source key unless the source needs special metadata.

### API changes

- Expose source registry metadata to the UI.
- Expose run and phase status to the admin UI.

### Job/workflow changes

- Add phase-specific job types only when the phase truly needs independent retry/recovery.

### Notes

- New source types should not require rewriting the pipeline.

---

## Suggested File/Module Layout

### Application

- `Research/SearchSources.cs`
- `Research/ResearchTopicRun.cs`
- `Research/ResearchWorkflow.cs`
- `Research/ISearchQueryPlanner.cs`
- `Research/IResearchSearchSourceAdapter.cs`
- `Research/IResearchContentFetcher.cs`
- `Research/IResearchNormalizer.cs`
- `Research/IResearchRanker.cs`
- `Research/IResearchSynthesisService.cs`

### Infrastructure

- `Research/Search/`
- `Research/Fetch/`
- `Research/Normalize/`
- `Research/Rank/`
- `Research/Synthesize/`
- `Research/Persistence/`

### API

- `ResearchController`
- `SearchProvidersController`
- `ResearchRunsController`
- `ResearchRunPhasesController`
- `ResearchContentController`

### Worker

- `research.topic.run`
- `research.topic.fetch`
- `research.topic.normalize`
- `research.topic.synthesize`

## Minimal First Delivery

If we want the smallest useful first step, implement in this order:

1. `research.topic.run` job and `research_topic_runs` / `research_topic_run_phases`
2. search intake + raw search persistence
3. content acquisition for `web` and `youtube`
4. normalization and ranking
5. synthesis and final briefing persistence
6. read-only API for runs and phases

---

## Current Status Checklist

- [x] Research topic model exists
- [x] Research topic run model exists
- [x] Research topic run/phase status model exists
- [x] Search provider admin API exists
- [x] Tavily-backed search provider exists
- [x] Reasoning provider layer exists
- [x] Source wrappers exist for web/news/archive/reddit/financial/twitter/youtube
- [x] Research run job payload and workflow orchestration
- [x] Search result persistence
- [x] Content acquisition layer
- [x] HTTP extraction
- [x] YouTube transcript pipeline integration
- [x] Normalization layer
- [x] Ranking layer
- [ ] Synthesis wiring into the research workflow
- [x] Synthesis wiring into the research workflow
- [x] Final briefing persistence
- [x] Run inspection API for synthesis runs
- [x] Run inspection API for topic runs and raw search results
- [x] Run inspection API for content items
- [x] Phase status API for a run
- [x] Execution history and phase status APIs
- [x] Run inspection API for normalized documents and chunks
- [x] Run inspection API for ranking runs and ranked documents

## Working Rule

When making changes, update this document first if the scope changes.
Use it as the single source of truth for what belongs in each phase.
