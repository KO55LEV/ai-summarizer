alter table jobs
    add column if not exists heartbeat_at timestamptz null,
    add column if not exists progress_percent smallint null,
    add column if not exists progress_message text null,
    add column if not exists cancel_requested_at timestamptz null;

alter table jobs
    add constraint ck_jobs_progress_percent check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100));

create index if not exists ix_jobs_running_heartbeat
    on jobs (status, heartbeat_at)
    where status = 'running';

create index if not exists ix_jobs_cancel_requested
    on jobs (cancel_requested_at)
    where cancel_requested_at is not null;

