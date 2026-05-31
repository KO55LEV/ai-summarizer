create table if not exists jobs (
    id uuid primary key default gen_random_uuid(),
    parent_job_id uuid null references jobs(id) on delete set null,
    requested_by_user_id uuid null references users(id) on delete set null,
    job_type text not null,
    priority integer not null default 100,
    status text not null default 'queued',
    payload_json jsonb not null default '{}'::jsonb,
    result_json jsonb null,
    error_code text null,
    error_message text null,
    error_details_json jsonb null,
    attempt_count integer not null default 0,
    max_attempts integer not null default 5,
    available_at timestamptz not null default now(),
    locked_by text null,
    locked_at timestamptz null,
    locked_until timestamptz null,
    started_at timestamptz null,
    finished_at timestamptz null,
    last_error_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_jobs_status check (
        status in ('queued', 'retry_wait', 'running', 'succeeded', 'failed', 'cancelled', 'dead')
    ),
    constraint ck_jobs_priority check (priority >= 0),
    constraint ck_jobs_attempts check (attempt_count >= 0 and max_attempts > 0 and attempt_count <= max_attempts),
    constraint ck_jobs_retry_schedule check (
        (status in ('queued', 'retry_wait') and locked_by is null and locked_at is null)
        or (status = 'running' and locked_by is not null and locked_at is not null and locked_until is not null)
        or (status in ('succeeded', 'failed', 'cancelled', 'dead'))
    )
);

create index if not exists ix_jobs_queue
    on jobs (status, priority asc, available_at asc, created_at asc)
    where status in ('queued', 'retry_wait');

create index if not exists ix_jobs_running
    on jobs (status, locked_until)
    where status = 'running';

create index if not exists ix_jobs_requested_by_user
    on jobs (requested_by_user_id, created_at desc);

create index if not exists ix_jobs_parent_job
    on jobs (parent_job_id);

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at
before update on jobs
for each row
execute function set_updated_at();

create table if not exists job_logs (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs(id) on delete cascade,
    attempt_no integer null,
    level text not null default 'info',
    message text not null,
    context_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists ix_job_logs_job_created_at
    on job_logs (job_id, created_at desc);

create index if not exists ix_job_logs_level
    on job_logs (level, created_at desc);

