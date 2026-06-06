# Notes Implementation Plan

This document is the working plan for the `notes` feature in `AiSummarizer`.
It should be used as the execution guide for database, API, UI, and Telegram integration work.

The main idea is:

- a user can create notes from the web UI
- notes can also arrive from Telegram later
- a note may contain text, audio, images, or mixed inputs
- raw input must be preserved
- the system should create a cleaner LLM-generated version for display
- the first version should store files locally, but the design must be ready for cloud storage later

## Product Scope

The `notes` area should become a first-class top-level section alongside research and the existing content areas.

The product should also support `projects` as a higher-level container that groups:

- notes
- research topics
- future project files and activity

User-facing goals:

- create a note from the main page
- add text manually
- attach or send audio
- attach or send images
- transcribe voice notes with Whisper
- rewrite rough text into a cleaner note using an LLM
- see the original input and the polished output separately
- manage Telegram linkage in Settings so the correct account is associated with the correct user
- group notes and research into a project when the user wants a topic-based workspace

System goals:

- preserve raw inputs
- keep file storage abstraction isolated from business logic
- make Telegram ingestion multi-user safe
- allow local filesystem storage now
- make cloud storage migration later a configuration and adapter change, not a data-model rewrite
- support automatic project routing for Telegram voice notes and text notes

## Core Design Rules

1. Keep the note record separate from note inputs and processing runs.
2. Store raw input, derived text, and polished text as distinct versions.
3. Store files by stable storage key, not by hardcoded absolute paths.
4. Put all note processing behind jobs or background handlers.
5. Treat Telegram as just another ingestion channel, not as the source of truth for note ownership.
6. Keep the schema forward-compatible with Google Cloud Storage or any other object store.

## Recommended Data Model

The exact table names can be finalized during Phase 1, but the model should look like this:

### `notes`

One row per user-visible note.

Recommended fields:

- `id`
- `user_id`
- `project_id`
- `title`
- `status`
- `source_channel`
- `input_kind`
- `primary_language`
- `current_text_version_id`
- `summary`
- `created_at`
- `updated_at`

### `note_inputs`

One row per ingestion event.

Recommended fields:

- `id`
- `note_id`
- `source_channel`
- `external_message_id`
- `input_kind`
- `raw_text`
- `raw_payload_json`
- `received_at`
- `processed_at`
- `status`

### `note_assets`

One row per stored file.

Recommended fields:

- `id`
- `note_id`
- `note_input_id`
- `asset_type`
- `mime_type`
- `storage_key`
- `original_filename`
- `size_bytes`
- `checksum_sha256`
- `duration_seconds`
- `width`
- `height`
- `metadata_json`

### `note_text_versions`

One row per text variant.

Recommended fields:

- `id`
- `note_id`
- `version_kind`
- `text`
- `language`
- `provider`
- `model`
- `prompt_version`
- `source_run_id`
- `created_at`

### `note_processing_runs`

One row per processing stage execution.

Recommended fields:

- `id`
- `note_id`
- `job_id`
- `stage`
- `status`
- `request_json`
- `response_json`
- `error_code`
- `error_message`
- `started_at`
- `finished_at`

### Telegram identity mapping

Because one bot will receive messages from many users, we need a durable mapping from Telegram sender identity to our user account.

Recommended separate tables:

- `telegram_accounts`
- `user_telegram_accounts`

Suggested purpose:

- `telegram_accounts` stores Telegram identity data such as `telegram_user_id`, username, display name, and last seen timestamps
- `user_telegram_accounts` links a Telegram account to one internal `user_id`
- this lets us resolve inbound messages to the correct user before creating a note

### `projects`

One row per user workspace or topic container.

Recommended fields:

- `id`
- `user_id`
- `name`
- `description`
- `status`
- `color`
- `icon`
- `is_default`
- `created_at`
- `updated_at`

Recommended behavior:

- a user can have multiple projects
- notes can belong to exactly one project or no project
- unassigned notes fall back to an inbox or general workspace
- research topics can also be attached to a project later

### `research_topics.project_id`

If we want research and notes to live in the same workspace structure, add a nullable `project_id` to `research_topics`.

That gives us:

- a single topic container for research and notes
- one place to view linked notes, research runs, and future artifacts
- a smoother UI for “work on project A” flows

## Storage Layout

### Local storage first

The first implementation should store files under a local project directory such as `data/`.

Recommended structure:

```text
data/
  notes/
    {user_id}/
      {note_id}/
        manifest.json
        inputs/
          {note_input_id}/
            raw.json
            original.txt
        assets/
          {asset_id}/
            original.mp3
            original.jpg
            preview.webp
        derived/
          {run_id}/
            whisper.txt
            polished.txt
            ocr.txt
```

### Storage key rule

The database should store a `storage_key` such as:

`notes/{user_id}/{note_id}/assets/{asset_id}/original.mp3`

That key should work the same way whether the backing store is:

- local filesystem
- Google Cloud Storage
- another object store

The code should resolve the key through a storage adapter instead of hardcoding file paths in application logic.

## Execution Phases

## Phase 0: Finalize scope and contract

Purpose:

- freeze the note lifecycle
- define the storage contract
- define the Telegram identity strategy
- define the project model and whether `research_topics` should reference `projects`

Work:

- confirm which note entry points exist in v1
- confirm which text variants are stored
- confirm whether OCR is required in v1 or later
- confirm whether note edits are allowed after creation
- define the settings entry for Telegram account binding
- define the note statuses and processing statuses

Output:

- agreed schema contract
- agreed ingestion contract
- agreed storage contract

## Phase 1: Database and persistence foundation

Purpose:

- create the durable schema first
- align it with the existing SQL-first pattern in `db/migrations`

Work:

- add SQL migrations for the `notes` domain
- add indexes for lookup by `user_id`, `created_at`, `status`, and external IDs
- add JSONB fields only where they are genuinely needed
- add updated-at triggers in the same style as existing tables
- create repositories and SQL scripts in `src/AiSummarizer.Infrastructure/Sql/Notes`
- create domain records in `src/AiSummarizer.Domain/Notes`
- create application abstractions for notes
- add the first local filesystem storage adapter

Recommended database objects:

- `notes`
- `projects`
- `note_inputs`
- `note_assets`
- `note_text_versions`
- `note_processing_runs`
- `telegram_accounts`
- `user_telegram_accounts`
- optionally `research_topics.project_id`

Important database rules:

- keep note inputs immutable
- keep derived text versions append-only
- keep the current note view as a pointer to the latest useful version
- keep file references as storage keys, not absolute paths

## Phase 2: API and job pipeline

Purpose:

- expose note creation and retrieval through the backend
- route heavy work into jobs or worker handlers

Work:

- create API contracts for notes
- create API contracts for projects
- create endpoints for:
  - list notes
  - get note details
  - create note from text
  - attach file(s)
  - request processing
  - link Telegram account
  - list projects
  - create project
  - attach note to project
  - move note between projects
- create job handlers for:
  - audio transcription with Whisper
  - optional OCR for images
  - LLM rewriting into a polished note
  - project routing from note text or transcript
- persist processing results into the note version tables
- persist failure states and error details for retry/debugging

Behavior rules:

- raw text is always stored
- Whisper output is stored separately from the original input
- polished LLM output is stored separately from Whisper output
- the note can be rendered even if one stage fails
- if the user does not explicitly choose a project, the system may infer one

### Project routing strategy

For Telegram and other hands-free inputs, the system should use a two-step routing strategy:

1. deterministic matching first
   - explicit project commands
   - known project names mentioned in the text
   - aliases or short codes if we add them later
2. LLM fallback second
   - inspect the transcribed text
   - compare against the user’s existing project list
   - choose the best project if confidence is sufficient
   - otherwise route to the default inbox / general project

This keeps the behavior predictable:

- explicit selection always wins
- if no project is named, inference is allowed
- if inference is weak, do not guess aggressively
- the system should prefer the inbox over a wrong assignment

For voice notes, the recommended flow is:

- store raw audio
- run Whisper
- run project routing on the transcript
- if a project is found, attach the note to it
- if not, keep the note unassigned or in inbox

## Phase 3: UI and product surface

Purpose:

- make notes visible in the app
- give the user a simple creation and browsing flow

Work:

- add a new top-level `Notes` tab in the sidebar
- add a new top-level `Projects` tab or project switcher in the UI
- add a Notes page on the main surface
- add note creation UI
- add note detail view
- add a project detail view that shows linked notes and research
- show raw input, transcribed text, and polished text clearly
- show attached files and processing state
- add Settings UI for Telegram account connection

Settings requirements:

- add a new settings subsection or tab for Telegram
- let the user connect or verify their Telegram identity
- show the Telegram account currently linked to the app user
- allow re-linking or unlinking if needed
- add a default project selector for quick note creation

## Phase 4: Telegram ingestion

Purpose:

- allow Telegram messages to create notes for the correct user

Work:

- implement Telegram bot ingestion
- parse inbound updates
- resolve sender identity to the linked internal user
- create a note and note input from the inbound message
- store text, audio, and image payloads
- queue transcription / rewrite jobs when needed
- route the note to a project when possible

Important behavior:

- the bot receives messages from all users
- the system must map each inbound Telegram sender to one internal user
- unlinked users should not create notes until account linking is completed
- all inbound Telegram data should be stored with enough metadata for debugging
- if the message mentions a project explicitly, attach it
- if the message is a voice note, use the transcript for project inference
- if no safe project match exists, store it in the default inbox

### Suggested project inference inputs

- project name
- project description
- recent project activity
- existing note text inside each project
- research topic titles and summaries if research is project-linked

The inference step should return:

- matched project id or null
- confidence score
- reason string for audit/debugging

## Phase 5: Cloud readiness and migration

Purpose:

- make the local implementation portable to cloud storage later

Work:

- keep the storage adapter interface stable
- add a Google Cloud Storage implementation later without changing the note schema
- support signed URLs if needed
- keep generated paths and keys compatible with object storage
- document migration steps for moving local files into cloud storage

Migration rule:

- only the storage backend should change
- note rows, input rows, and version rows should remain valid

## Phase 6: Polish and hardening

Purpose:

- make the feature reliable enough for day-to-day use

Work:

- add tests for note creation and ingestion
- add tests for Telegram user mapping
- add tests for transcription and rewrite pipeline behavior
- verify permission boundaries by user
- verify that file cleanup and retries do not orphan records
- add observability for failed note processing

## Implementation Order

The practical order should be:

1. database schema
2. SQL scripts and repositories
3. application abstractions
4. API endpoints
5. worker/job handlers
6. frontend notes tab
7. settings Telegram link UI
8. Telegram bot ingestion
9. storage adapter hardening for cloud

## Open Questions to Resolve Before Coding

- Should image notes always run OCR in v1, or only when explicitly requested?
- Do we allow direct editing of polished notes, or only create a new user-edited version?
- Do we want one note per Telegram message, or message grouping for threads/voice sequences?
- Should notes be searchable globally like transcripts and research?
- Do we need sharing/public links in v1?
- Should project routing use only the note transcript, or also project history and embeddings later?
