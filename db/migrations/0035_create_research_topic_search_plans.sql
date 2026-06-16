create table if not exists research_topic_search_plans (
    id uuid primary key,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    plan_version integer not null default 1,
    prompt_key text not null,
    prompt_version text not null,
    provider text not null,
    model text not null,
    status text not null,
    plan_json jsonb null,
    input_hash text not null,
    source_hash text null,
    generated_at timestamptz null,
    error_code text null,
    error_message text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_research_topic_search_plans_topic_id
    on research_topic_search_plans (research_topic_id);

create index if not exists ix_research_topic_search_plans_status
    on research_topic_search_plans (status);
