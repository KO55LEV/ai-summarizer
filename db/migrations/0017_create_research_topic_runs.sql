create table if not exists research_topic_runs (
    id uuid primary key default gen_random_uuid(),
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    requested_by_user_id uuid null references users(id) on delete set null,
    job_id uuid null references jobs(id) on delete set null,
    status text not null default 'queued',
    triggered_by text null,
    started_at timestamptz null,
    finished_at timestamptz null,
    next_retry_at timestamptz null,
    error_code text null,
    error_message text null,
    summary_preview text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_research_topic_runs_status check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);

create index if not exists ix_research_topic_runs_topic_created
    on research_topic_runs (research_topic_id, created_at desc);

create index if not exists ix_research_topic_runs_status
    on research_topic_runs (status, created_at desc);

create index if not exists ix_research_topic_runs_job
    on research_topic_runs (job_id);

drop trigger if exists trg_research_topic_runs_updated_at on research_topic_runs;
create trigger trg_research_topic_runs_updated_at
before update on research_topic_runs
for each row
execute function set_updated_at();

create table if not exists research_topic_run_phases (
    id uuid primary key default gen_random_uuid(),
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    phase_key text not null,
    status text not null default 'queued',
    attempt_count integer not null default 0,
    started_at timestamptz null,
    finished_at timestamptz null,
    error_code text null,
    error_message text null,
    metrics_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_research_topic_run_phases unique (research_topic_run_id, phase_key),
    constraint ck_research_topic_run_phases_status check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped', 'retrying')),
    constraint ck_research_topic_run_phases_attempts check (attempt_count >= 0)
);

create index if not exists ix_research_topic_run_phases_run_status
    on research_topic_run_phases (research_topic_run_id, status);

drop trigger if exists trg_research_topic_run_phases_updated_at on research_topic_run_phases;
create trigger trg_research_topic_run_phases_updated_at
before update on research_topic_run_phases
for each row
execute function set_updated_at();

create table if not exists research_search_runs (
    id uuid primary key default gen_random_uuid(),
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_run_phase_id uuid not null references research_topic_run_phases(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    source_key text not null,
    planner_version text not null,
    query_count integer not null default 0,
    status text not null default 'queued',
    started_at timestamptz null,
    finished_at timestamptz null,
    error_code text null,
    error_message text null,
    metrics_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_research_search_runs_status check (status in ('queued', 'running', 'succeeded', 'failed'))
);

create index if not exists ix_research_search_runs_topic_run
    on research_search_runs (research_topic_run_id, created_at desc);

create index if not exists ix_research_search_runs_phase
    on research_search_runs (research_topic_run_phase_id, created_at desc);

create index if not exists ix_research_search_runs_source
    on research_search_runs (source_key, created_at desc);

drop trigger if exists trg_research_search_runs_updated_at on research_search_runs;
create trigger trg_research_search_runs_updated_at
before update on research_search_runs
for each row
execute function set_updated_at();

create table if not exists research_search_results (
    id uuid primary key default gen_random_uuid(),
    research_search_run_id uuid not null references research_search_runs(id) on delete cascade,
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    source_key text not null,
    query text not null,
    title text not null,
    url text not null,
    canonical_url text null,
    snippet text null,
    score double precision not null default 0,
    published_at timestamptz null,
    author_name text null,
    domain text null,
    language text null,
    result_rank integer not null default 0,
    raw_result_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_research_search_results_topic_run
    on research_search_results (research_topic_run_id, result_rank asc, created_at asc);

create index if not exists ix_research_search_results_search_run
    on research_search_results (research_search_run_id, result_rank asc);

create index if not exists ix_research_search_results_url
    on research_search_results (canonical_url);

drop trigger if exists trg_research_search_results_updated_at on research_search_results;
create trigger trg_research_search_results_updated_at
before update on research_search_results
for each row
execute function set_updated_at();
