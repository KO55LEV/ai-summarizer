# Database migrations

This project uses SQL-first migrations.

Rules:

- every schema change gets a new file
- never edit old migrations after they are committed
- migrations are ordered by prefix number
- use one file per change set

Suggested layout:

```text
db/
  migrations/
    0001_create_users.sql
    0002_create_auth_identities.sql
    0003_...
```

All project tables live in `public`. Keep new tables there so the database stays single-schema unless we explicitly decide to split it later.

Seed data and manual test fixtures live in `db/seeds`.

Transcript data lives in three core tables:

- `media_sources` for normalized cross-platform source identity and cached discovery data
- `transcripts` for the transcript root record and searchable plain text
- `transcript_segments` for timestamped segment rows
- `transcript_artifacts` for future AI outputs built from a transcript, such as summaries, quotes, quizzes, and study guides
- `public_request_runs` for public API request audit logs with request/response payloads, timing, source/workflow links, and endpoint metadata
- `user_video_library` for per-user ownership of summarized videos, including shared transcript links and processing state

TODO:

- enforce user ownership checks on transcript and video detail endpoints using `user_video_library`, while keeping `transcripts` and other source artifacts shared and reusable across users

Notes and project data live in:

- `projects` for user workspaces and topic containers
- `notes` for user-visible notes tied to a project or inbox
- `note_inputs` for immutable raw inputs and external message metadata
- `note_assets` for file metadata and storage keys
- `note_text_versions` for append-only original, transcript, polished, and edited text variants
- `note_processing_runs` for ingestion, routing, transcription, OCR, and rewrite audit rows
- `telegram_accounts` and `user_telegram_accounts` for Telegram identity mapping and account linking

Workflow data lives in:

- `workflows` for the user-facing orchestration state
- `workflow_steps` for each step inside a workflow
- `workflow_events` for the timeline / event log

Role data lives in:

- `roles` for reusable access roles such as `admin`, `user`, `moderator`, `editor`, `support`, and `viewer`
- `user_roles` for the many-to-many assignment between users and roles

Prompt data lives in:

- `prompts` for reusable LLM prompt templates with provider and model metadata
- `prompt_archive` for immutable prompt snapshots captured on update/delete
- `prompt_runs` for execution audit logs with request/response payloads and token usage

`media_sources` stores the normalized source identity:

- `source_provider`
- `source_kind`
- `external_source_id`
- `canonical_url`
- `original_url`
- `native_transcript_available`
- `native_transcript_checked_at`
- `native_transcript_language`

`transcripts.source_id` and `workflows.source_id` reference `media_sources.id`. `transcripts.source_url` stays available as legacy compatibility data and can still store the canonical or original source URL. `source_file_path` stays available for audio-backed transcripts and can be null when the transcript comes straight from the video source.
