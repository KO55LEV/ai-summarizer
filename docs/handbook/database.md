# База данных

Проект использует PostgreSQL и SQL-first миграции.

## Правила миграций

- каждая схема-изменение получает отдельный файл
- старые миграции не редактируются после коммита
- миграции идут по возрастающему префиксу
- все таблицы живут в `public`

## Группы таблиц

### Пользователи и аутентификация

- `users`
- `auth_identities`
- `sessions`
- `roles`
- `user_roles`

`users.status`:

- `active`
- `disabled`
- `deleted`

`roles` сейчас включает:

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

### Media sources

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

### Notes and projects

- `projects`
- `notes`
- `note_inputs`
- `note_assets`
- `note_text_versions`
- `note_processing_runs`
- `telegram_accounts`
- `user_telegram_accounts`

`projects` stores user workspaces and topic containers.

`notes` stores user-visible notes and can point to a project via `project_id`.

`note_inputs` stores immutable ingestion events and raw payloads.

`note_assets` stores file metadata and `storage_key` references for local or cloud storage.

`note_text_versions` stores append-only text variants such as original text, Whisper transcript, polished LLM output, and user-edited text.

`note_processing_runs` stores the audit trail for ingestion, routing, transcription, OCR, and rewrite stages.

`telegram_accounts` and `user_telegram_accounts` store Telegram identity and the user-to-account link used for message routing.

## Что хранится в prompts

`prompts` содержит текущую версию шаблона:

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

## Что хранится в prompt_archive

`prompt_archive` хранит immutable snapshots:

- момент создания
- каждое обновление
- удаление

Это нужно, чтобы можно было понять:

- что именно было изменено
- когда это было изменено
- какой текст реально использовался раньше

## Что хранится в prompt_runs

`prompt_runs` хранит audit trail выполнения промпта:

- request JSON
- response JSON
- статус запуска
- error_code
- error_message
- input/output/total tokens
- duration
- started_at / finished_at

## Важные связи

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

Seed-файлы используются для bootstrap и ручной проверки:

- test user
- base roles
- youtube job fixtures
- workflow fixtures
- prompt fixtures
- research fixtures

`db/seeds/0008_seed_roles_and_admin_user.sql` создает базовые роли и назначает test user в `admin`.
