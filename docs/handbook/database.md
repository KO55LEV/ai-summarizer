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

### Transcripts

- `transcripts`
- `transcript_segments`
- `transcript_artifacts`

`transcripts.status`:

- `queued`
- `running`
- `ready`
- `failed`

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
- `workflow_steps.workflow_id` -> `workflows.id`
- `workflow_steps.job_id` -> `jobs.id`
- `workflow_events.workflow_id` -> `workflows.id`
- `user_roles.user_id` -> `users.id`
- `user_roles.role_id` -> `roles.id`
- `prompt_archive.prompt_id` -> `prompts.id`
- `prompt_runs.prompt_id` -> `prompts.id`

## Seeds

Seed-файлы используются для bootstrap и ручной проверки:

- test user
- base roles
- youtube job fixtures
- workflow fixtures
- prompt fixtures

`db/seeds/0008_seed_roles_and_admin_user.sql` создает базовые роли и назначает test user в `admin`.
