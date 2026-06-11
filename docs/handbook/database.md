# Database

The project uses PostgreSQL and SQL-first migrations.

## Migration Rules

- Each schema change gets a separate file
- Old migrations are not edited after they are committed
- Migrations are ordered by an increasing prefix
- All tables live in the `public` schema

## Table Groups

### Users and Authentication

- `users`
- `auth_identities`
- `sessions`
- `roles`
- `user_roles`

`users.status`:

- `active`
- `disabled`
- `deleted`

`roles` currently includes:

- `admin`
- `user`
- `moderator`
- `editor`
- `support`
- `viewer`

### Jobs

- `jobs`
- `job_logs`

`jobs.status`:

- `queued`
- `retry_wait`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `dead`

### Media Sources

- `media_sources`

`media_sources` is the normalized identity layer for external content sources. It stores:

- `source_provider` such as `youtube` or `facebook`
- `source_kind` such as `video`
- `external_source_id` as the provider-specific stable id
- `canonical_url`
- `original_url`
- cached native transcript discovery metadata

### Transcripts

- `transcripts`
- `transcript_segments`
- `transcript_artifacts`
- `public_request_runs`

`transcripts` stores the normalized transcript body, including `transcript_text` for the full text view and `source_id` for UI lookups.

`transcripts.status`:

- `queued`
- `running`
- `ready`
- `failed`

`public_request_runs` stores the public API audit trail:

- `api_area`, `operation_name`, `http_method`, `request_path`
- `source_url` and source identity snapshot for UI/history
- request JSON
- response JSON
- status
- error code / error message
- source identity
- workflow / transcript ids
- started_at / finished_at

TODO:

- enforce user ownership on transcript and video detail endpoints with `user_video_library` lookups, while keeping shared transcript storage reusable across users

### Workflows

- `workflows`
- `workflow_steps`
- `workflow_events`

`workflows.status`:

- `queued`
- `running`
- `waiting`
- `succeeded`
- `failed`
- `cancelled`
- `dead`

`workflow_steps.status`:

- `queued`
- `running`
- `waiting`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`

### Prompts

- `prompts`
- `prompt_archive`
- `prompt_runs`

### Research

- `research_topics`
- `research_topic_sources`
- `research_topic_tags`
- `research_topic_outputs`
- `research_briefings`
- `research_briefing_sections`
- `research_briefing_sources`

`research_topics` stores the user-scoped research definition:

- `requested_by_user_id`
- `project_id`
- `name`
- `description`
- `frequency`
- `status`
- `delivery_time`
- `last_run_at`
- `next_run_at`
- `last_briefing_preview`

`research_topics.frequency`:

- `hourly`
- `daily`
- `weekly`
- `monthly`

`research_topics.status`:

- `active`
- `paused`
- `draft`

`research_briefing_sections.sentiment`:

- `positive`
- `neutral`
- `negative`

`research_briefings` stores generated history records for a topic:

- `research_topic_id`
- `requested_by_user_id`
- `briefing_version`
- `generated_at`
- `period_label`
- `read_time_minutes`
- `word_count`
- `summary`
- `preview_text`

`research_briefing_sections` stores briefing sections with `items_jsonb` as an array of bullet text items.

`research_briefing_sources` stores the cited source list for each briefing.

### Notes and Projects

- `projects`
- `notes`
- `todo_items`
- `note_inputs`
- `note_assets`
- `note_text_versions`
- `note_processing_runs`
- `telegram_accounts`
- `user_telegram_accounts`

`projects` stores user workspaces and topic containers.

`notes` stores user-visible notes and can point to a project via `project_id`.

`todo_items` stores user tasks and targets. It can be:

- personal, with no `project_id`
- project-linked, for work inside a workspace
- recurring by `cadence`:
  - `daily`
  - `weekly`
  - `monthly`
  - `yearly`
  - `target`

`todo_items.status`:

- `open`
- `doing`
- `blocked`
- `done`
- `archived`

`todo_items.priority`:

- `low`
- `medium`
- `high`
- `urgent`

`note_inputs` stores immutable ingestion events and raw payloads.

`note_assets` stores file metadata and `storage_key` references for local or cloud storage.

`note_text_versions` stores append-only text variants such as original text, Whisper transcript, polished LLM output, and user-edited text.

`note_processing_runs` stores the audit trail for ingestion, routing, transcription, OCR, and rewrite stages.

`telegram_accounts` and `user_telegram_accounts` store Telegram identity and the user-to-account link used for message routing.

## What is stored in prompts

`prompts` contains the current version of the template:

- `prompt_key`
- `title`
- `description`
- `workflow_type`
- `provider`
- `model`
- `system_prompt`
- `user_prompt`
- `is_active`
- `created_at`
- `updated_at`

## What is stored in prompt_archive

`prompt_archive` stores immutable snapshots:

- moment of creation
- each update
- deletion

This is necessary to understand:

- what exactly was changed
- when it was changed
- what text was actually used in the past

## What is stored in prompt_runs

`prompt_runs` stores the audit trail of prompt execution:

- request JSON
- response JSON
- run status
- error_code
- error_message
- input/output/total tokens
- duration
- started_at / finished_at

## Key Relationships

- `auth_identities.user_id` -> `users.id`
- `sessions.user_id` -> `users.id`
- `sessions.auth_identity_id` -> `auth_identities.id`
- `jobs.requested_by_user_id` -> `users.id`
- `workflow.requested_by_user_id` -> `users.id`
- `workflows.source_id` -> `media_sources.id`
- `transcripts.source_id` -> `media_sources.id`
- `workflow_steps.workflow_id` -> `workflows.id`
- `workflow_steps.job_id` -> `jobs.id`
- `workflow_events.workflow_id` -> `workflows.id`
- `user_roles.user_id` -> `users.id`
- `user_roles.role_id` -> `roles.id`
- `prompt_archive.prompt_id` -> `prompts.id`
- `prompt_runs.prompt_id` -> `prompts.id`
- `research_topics.requested_by_user_id` -> `users.id`
- `research_briefings.requested_by_user_id` -> `users.id`
- `research_topic_sources.research_topic_id` -> `research_topics.id`
- `research_topic_tags.research_topic_id` -> `research_topics.id`
- `research_topic_outputs.research_topic_id` -> `research_topics.id`
- `research_briefings.research_topic_id` -> `research_topics.id`
- `research_briefing_sections.research_briefing_id` -> `research_briefings.id`
- `research_briefing_sources.research_briefing_id` -> `research_briefings.id`

## Seeds

Seed files are used for bootstrapping and manual testing:

- test user
- base roles
- youtube job fixtures
- workflow fixtures
- prompt fixtures
- research fixtures

`db/seeds/0008_seed_roles_and_admin_user.sql` creates base roles and assigns the test user as `admin`.

