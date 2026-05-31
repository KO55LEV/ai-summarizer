create table if not exists workflows (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    workflow_type text not null,
    status text not null default 'queued',
    input_json jsonb not null default '{}'::jsonb,
    result_json jsonb null,
    current_step_key text null,
    error_code text null,
    error_message text null,
    attempt_count integer not null default 0,
    max_attempts integer not null default 5,
    available_at timestamptz not null default now(),
    locked_by text null,
    locked_at timestamptz null,
    locked_until timestamptz null,
    started_at timestamptz null,
    finished_at timestamptz null,
    heartbeat_at timestamptz null,
    progress_percent smallint null,
    progress_message text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_workflows_status check (
        status in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'dead')
    ),
    constraint ck_workflows_attempts check (attempt_count >= 0 and max_attempts > 0 and attempt_count <= max_attempts),
    constraint ck_workflows_progress check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100))
);

create index if not exists ix_workflows_queue
    on workflows (status, available_at asc, created_at asc)
    where status in ('queued', 'waiting');

create index if not exists ix_workflows_running
    on workflows (status, locked_until)
    where status = 'running';

create index if not exists ix_workflows_requested_by_user
    on workflows (requested_by_user_id, created_at desc);

create index if not exists ix_workflows_type_created
    on workflows (workflow_type, created_at desc);

drop trigger if exists trg_workflows_updated_at on workflows;
create trigger trg_workflows_updated_at
before update on workflows
for each row
execute function set_updated_at();

create table if not exists workflow_steps (
    id uuid primary key default gen_random_uuid(),
    workflow_id uuid not null references workflows(id) on delete cascade,
    step_order integer not null,
    step_key text not null,
    step_type text not null,
    job_id uuid null references jobs(id) on delete set null,
    status text not null default 'queued',
    input_json jsonb not null default '{}'::jsonb,
    output_json jsonb null,
    error_code text null,
    error_message text null,
    started_at timestamptz null,
    finished_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_workflow_steps_order unique (workflow_id, step_order),
    constraint uq_workflow_steps_key unique (workflow_id, step_key),
    constraint ck_workflow_steps_status check (status in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled')),
    constraint ck_workflow_steps_type check (length(trim(step_type)) > 0),
    constraint ck_workflow_steps_order_nonnegative check (step_order >= 0)
);

create index if not exists ix_workflow_steps_workflow_order
    on workflow_steps (workflow_id, step_order asc);

create index if not exists ix_workflow_steps_workflow_status
    on workflow_steps (workflow_id, status);

create index if not exists ix_workflow_steps_job
    on workflow_steps (job_id);

drop trigger if exists trg_workflow_steps_updated_at on workflow_steps;
create trigger trg_workflow_steps_updated_at
before update on workflow_steps
for each row
execute function set_updated_at();

create table if not exists workflow_events (
    id uuid primary key default gen_random_uuid(),
    workflow_id uuid not null references workflows(id) on delete cascade,
    step_key text null,
    level text not null default 'info',
    message text not null,
    context_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists ix_workflow_events_workflow_created_at
    on workflow_events (workflow_id, created_at desc);

create index if not exists ix_workflow_events_level
    on workflow_events (level, created_at desc);
