create table if not exists public_request_runs (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    api_area text not null default 'public',
    operation_name text not null,
    http_method text not null,
    request_path text not null,
    source_id uuid null references media_sources(id) on delete set null,
    source_provider text null,
    source_kind text null,
    external_source_id text null,
    source_url text null,
    workflow_id uuid null references workflows(id) on delete set null,
    transcript_id uuid null references transcripts(id) on delete set null,
    request_json jsonb not null default '{}'::jsonb,
    response_json jsonb null,
    status text not null default 'running',
    error_code text null,
    error_message text null,
    started_at timestamptz not null default now(),
    finished_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_public_request_runs_status check (status in ('running', 'succeeded', 'failed', 'cancelled'))
);

alter table public_request_runs
    add column if not exists source_url text null;

create index if not exists ix_public_request_runs_source_created_at
    on public_request_runs (source_id, created_at desc);

create index if not exists ix_public_request_runs_status_created_at
    on public_request_runs (status, created_at desc);

create index if not exists ix_public_request_runs_workflow_created_at
    on public_request_runs (workflow_id, created_at desc);

create index if not exists ix_public_request_runs_transcript_created_at
    on public_request_runs (transcript_id, created_at desc);

drop trigger if exists trg_public_request_runs_updated_at on public_request_runs;
create trigger trg_public_request_runs_updated_at
before update on public_request_runs
for each row
execute function set_updated_at();
