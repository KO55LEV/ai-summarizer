create table if not exists projects (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    name text not null,
    description text null,
    status text not null default 'active',
    color text null,
    icon text null,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_projects_status check (status in ('active', 'archived', 'deleted')),
    constraint ck_projects_name check (length(trim(name)) > 0)
);

create index if not exists ix_projects_requested_by_created_at
    on projects (requested_by_user_id, created_at desc);

create index if not exists ix_projects_status_created_at
    on projects (status, created_at desc);

create unique index if not exists ux_projects_default_per_user
    on projects (requested_by_user_id)
    where is_default;

alter table research_topics
    add column if not exists project_id uuid null references projects(id) on delete set null;

create index if not exists ix_research_topics_project_created_at
    on research_topics (project_id, created_at desc);

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
before update on projects
for each row
execute function set_updated_at();

create table if not exists telegram_accounts (
    id uuid primary key default gen_random_uuid(),
    telegram_user_id bigint not null,
    username text null,
    first_name text null,
    last_name text null,
    display_name text null,
    language_code text null,
    is_bot boolean not null default false,
    last_seen_at timestamptz null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_telegram_accounts_telegram_user_id
    on telegram_accounts (telegram_user_id);

drop trigger if exists trg_telegram_accounts_updated_at on telegram_accounts;
create trigger trg_telegram_accounts_updated_at
before update on telegram_accounts
for each row
execute function set_updated_at();

create table if not exists user_telegram_accounts (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid not null references users(id) on delete cascade,
    telegram_account_id uuid not null references telegram_accounts(id) on delete cascade,
    linked_at timestamptz not null default now(),
    revoked_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_user_telegram_accounts_active_user
    on user_telegram_accounts (requested_by_user_id)
    where revoked_at is null;

create unique index if not exists ux_user_telegram_accounts_active_telegram_account
    on user_telegram_accounts (telegram_account_id)
    where revoked_at is null;

create index if not exists ix_user_telegram_accounts_user_created_at
    on user_telegram_accounts (requested_by_user_id, created_at desc);

drop trigger if exists trg_user_telegram_accounts_updated_at on user_telegram_accounts;
create trigger trg_user_telegram_accounts_updated_at
before update on user_telegram_accounts
for each row
execute function set_updated_at();

create table if not exists notes (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    project_id uuid null references projects(id) on delete set null,
    title text not null default '',
    status text not null default 'draft',
    source_channel text not null default 'web',
    input_kind text not null default 'text',
    primary_language text null,
    current_text_version_id uuid null,
    summary text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_notes_status check (status in ('draft', 'processing', 'ready', 'failed', 'archived', 'deleted')),
    constraint ck_notes_source_channel check (source_channel in ('web', 'telegram', 'api')),
    constraint ck_notes_input_kind check (input_kind in ('text', 'audio', 'image', 'file', 'mixed'))
);

create index if not exists ix_notes_requested_by_created_at
    on notes (requested_by_user_id, created_at desc);

create index if not exists ix_notes_project_created_at
    on notes (project_id, created_at desc);

create index if not exists ix_notes_status_created_at
    on notes (status, created_at desc);

create index if not exists ix_notes_source_channel_created_at
    on notes (source_channel, created_at desc);

drop trigger if exists trg_notes_updated_at on notes;
create trigger trg_notes_updated_at
before update on notes
for each row
execute function set_updated_at();

create table if not exists note_inputs (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes(id) on delete cascade,
    source_channel text not null,
    external_source_id text null,
    external_message_id text null,
    input_kind text not null,
    raw_text text null,
    raw_payload_json jsonb not null default '{}'::jsonb,
    status text not null default 'queued',
    received_at timestamptz not null default now(),
    processed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_note_inputs_source_channel check (source_channel in ('web', 'telegram', 'api')),
    constraint ck_note_inputs_input_kind check (input_kind in ('text', 'audio', 'image', 'file', 'mixed')),
    constraint ck_note_inputs_status check (status in ('queued', 'processing', 'succeeded', 'failed', 'skipped'))
);

create unique index if not exists ux_note_inputs_external_identity
    on note_inputs (source_channel, external_source_id, external_message_id)
    where external_source_id is not null and external_message_id is not null;

create index if not exists ix_note_inputs_note_received_at
    on note_inputs (note_id, received_at desc);

create index if not exists ix_note_inputs_status_received_at
    on note_inputs (status, received_at desc);

drop trigger if exists trg_note_inputs_updated_at on note_inputs;
create trigger trg_note_inputs_updated_at
before update on note_inputs
for each row
execute function set_updated_at();

create table if not exists note_assets (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes(id) on delete cascade,
    note_input_id uuid null references note_inputs(id) on delete set null,
    asset_type text not null,
    mime_type text not null,
    storage_key text not null,
    original_filename text null,
    size_bytes bigint null,
    checksum_sha256 text null,
    duration_seconds numeric(12,2) null,
    width integer null,
    height integer null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_note_assets_asset_type check (length(trim(asset_type)) > 0),
    constraint ck_note_assets_mime_type check (length(trim(mime_type)) > 0),
    constraint ck_note_assets_storage_key check (length(trim(storage_key)) > 0),
    constraint ck_note_assets_size check (size_bytes is null or size_bytes >= 0),
    constraint ck_note_assets_duration check (duration_seconds is null or duration_seconds >= 0),
    constraint ck_note_assets_dimensions check (
        (width is null or width >= 0) and (height is null or height >= 0)
    )
);

create index if not exists ix_note_assets_note_created_at
    on note_assets (note_id, created_at desc);

create index if not exists ix_note_assets_note_input_created_at
    on note_assets (note_input_id, created_at desc);

create unique index if not exists ux_note_assets_storage_key
    on note_assets (storage_key);

drop trigger if exists trg_note_assets_updated_at on note_assets;
create trigger trg_note_assets_updated_at
before update on note_assets
for each row
execute function set_updated_at();

create table if not exists note_text_versions (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes(id) on delete cascade,
    source_run_id uuid null,
    version_kind text not null,
    text text not null,
    language text null,
    provider text null,
    model text null,
    prompt_version text null,
    created_at timestamptz not null default now(),
    constraint ck_note_text_versions_version_kind check (version_kind in ('original', 'transcript', 'polished', 'user_edited', 'summary', 'ocr'))
);

create index if not exists ix_note_text_versions_note_created_at
    on note_text_versions (note_id, created_at asc);

create index if not exists ix_note_text_versions_note_kind_created_at
    on note_text_versions (note_id, version_kind, created_at desc);

create index if not exists ix_note_text_versions_source_run
    on note_text_versions (source_run_id);

create table if not exists note_processing_runs (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes(id) on delete cascade,
    job_id uuid null references jobs(id) on delete set null,
    stage text not null,
    status text not null default 'queued',
    provider text null,
    model text null,
    prompt_version text null,
    input_hash text null,
    request_json jsonb null,
    response_json jsonb null,
    output_json jsonb null,
    usage_json jsonb null,
    metrics_json jsonb null,
    error_code text null,
    error_message text null,
    started_at timestamptz null,
    finished_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_note_processing_runs_stage check (stage in ('ingest', 'route', 'whisper', 'ocr', 'rewrite', 'summarize')),
    constraint ck_note_processing_runs_status check (status in ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled'))
);

create index if not exists ix_note_processing_runs_note_created_at
    on note_processing_runs (note_id, created_at desc);

create index if not exists ix_note_processing_runs_job_created_at
    on note_processing_runs (job_id, created_at desc);

create index if not exists ix_note_processing_runs_stage_status_created_at
    on note_processing_runs (stage, status, created_at desc);

drop trigger if exists trg_note_processing_runs_updated_at on note_processing_runs;
create trigger trg_note_processing_runs_updated_at
before update on note_processing_runs
for each row
execute function set_updated_at();

alter table note_text_versions
    add constraint fk_note_text_versions_source_run
    foreign key (source_run_id) references note_processing_runs(id) on delete set null;

alter table notes
    add constraint fk_notes_current_text_version
    foreign key (current_text_version_id) references note_text_versions(id) on delete set null;
