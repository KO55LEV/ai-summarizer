create table if not exists research_ranking_runs (
    id uuid primary key default gen_random_uuid(),
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_run_phase_id uuid not null references research_topic_run_phases(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    status text not null,
    scoring_version text not null,
    total_documents integer not null default 0,
    selected_documents integer not null default 0,
    started_at timestamptz null,
    finished_at timestamptz null,
    error_code text null,
    error_message text null,
    metrics_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_research_ranking_runs_topic_run
    on research_ranking_runs (research_topic_run_id, created_at desc);

drop trigger if exists trg_research_ranking_runs_updated_at on research_ranking_runs;
create trigger trg_research_ranking_runs_updated_at
before update on research_ranking_runs
for each row
execute function set_updated_at();

create table if not exists research_ranked_documents (
    id uuid primary key default gen_random_uuid(),
    research_ranking_run_id uuid not null references research_ranking_runs(id) on delete cascade,
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    research_document_id uuid not null references research_documents(id) on delete cascade,
    source_key text not null,
    title text not null,
    canonical_url text not null,
    score double precision not null,
    freshness_score double precision not null,
    source_weight double precision not null,
    length_score double precision not null,
    rank_position integer not null,
    is_selected boolean not null default false,
    reason_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_research_ranked_documents_position unique (research_ranking_run_id, rank_position)
);

create index if not exists ix_research_ranked_documents_topic_run
    on research_ranked_documents (research_topic_run_id, rank_position asc);

create index if not exists ix_research_ranked_documents_ranking_run
    on research_ranked_documents (research_ranking_run_id, rank_position asc);

drop trigger if exists trg_research_ranked_documents_updated_at on research_ranked_documents;
create trigger trg_research_ranked_documents_updated_at
before update on research_ranked_documents
for each row
execute function set_updated_at();
