create table if not exists research_synthesis_runs (
    id uuid primary key default gen_random_uuid(),
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_run_phase_id uuid not null references research_topic_run_phases(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    research_ranking_run_id uuid not null references research_ranking_runs(id) on delete cascade,
    status text not null,
    reasoning_provider text not null,
    model text not null,
    prompt_version text not null,
    input_hash text not null,
    request_json jsonb null,
    response_json jsonb null,
    output_json jsonb null,
    usage_json jsonb null,
    selected_document_count integer not null default 0,
    started_at timestamptz null,
    finished_at timestamptz null,
    error_code text null,
    error_message text null,
    research_briefing_id uuid null references research_briefings(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_research_synthesis_runs_topic_run
    on research_synthesis_runs (research_topic_run_id, created_at desc);

create index if not exists ix_research_synthesis_runs_ranking_run
    on research_synthesis_runs (research_ranking_run_id, created_at desc);

drop trigger if exists trg_research_synthesis_runs_updated_at on research_synthesis_runs;
create trigger trg_research_synthesis_runs_updated_at
before update on research_synthesis_runs
for each row
execute function set_updated_at();
