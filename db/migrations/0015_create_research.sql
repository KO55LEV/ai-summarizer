create table if not exists research_topics (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    name text not null,
    description text null,
    frequency text not null,
    status text not null default 'draft',
    delivery_time time null,
    last_run_at timestamptz null,
    next_run_at timestamptz null,
    last_briefing_preview text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_research_topics_frequency check (frequency in ('hourly', 'daily', 'weekly', 'monthly')),
    constraint ck_research_topics_status check (status in ('active', 'paused', 'draft'))
);

create index if not exists ix_research_topics_requested_by_created_at
    on research_topics (requested_by_user_id, created_at desc);

create index if not exists ix_research_topics_status_next_run_at
    on research_topics (status, next_run_at asc);

drop trigger if exists trg_research_topics_updated_at on research_topics;
create trigger trg_research_topics_updated_at
before update on research_topics
for each row
execute function set_updated_at();

create table if not exists research_topic_sources (
    id uuid primary key default gen_random_uuid(),
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    source_key text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint uq_research_topic_sources unique (research_topic_id, source_key)
);

create index if not exists ix_research_topic_sources_topic_order
    on research_topic_sources (research_topic_id, sort_order asc);

create table if not exists research_topic_tags (
    id uuid primary key default gen_random_uuid(),
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    tag text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint uq_research_topic_tags unique (research_topic_id, tag)
);

create index if not exists ix_research_topic_tags_topic_order
    on research_topic_tags (research_topic_id, sort_order asc);

create table if not exists research_topic_outputs (
    id uuid primary key default gen_random_uuid(),
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    output_key text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint uq_research_topic_outputs unique (research_topic_id, output_key)
);

create index if not exists ix_research_topic_outputs_topic_order
    on research_topic_outputs (research_topic_id, sort_order asc);

create table if not exists research_briefings (
    id uuid primary key default gen_random_uuid(),
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    requested_by_user_id uuid null references users(id) on delete set null,
    briefing_version integer not null,
    generated_at timestamptz not null,
    period_label text not null,
    read_time_minutes integer not null,
    word_count integer not null,
    summary text not null,
    preview_text text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_research_briefings_topic_version unique (research_topic_id, briefing_version),
    constraint ck_research_briefings_read_time check (read_time_minutes >= 0),
    constraint ck_research_briefings_word_count check (word_count >= 0)
);

create index if not exists ix_research_briefings_topic_generated_at
    on research_briefings (research_topic_id, generated_at desc);

drop trigger if exists trg_research_briefings_updated_at on research_briefings;
create trigger trg_research_briefings_updated_at
before update on research_briefings
for each row
execute function set_updated_at();

create table if not exists research_briefing_sections (
    id uuid primary key default gen_random_uuid(),
    research_briefing_id uuid not null references research_briefings(id) on delete cascade,
    section_order integer not null,
    title text not null,
    sentiment text not null,
    items_jsonb jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    constraint uq_research_briefing_sections_order unique (research_briefing_id, section_order),
    constraint ck_research_briefing_sections_sentiment check (sentiment in ('positive', 'neutral', 'negative')),
    constraint ck_research_briefing_sections_items check (jsonb_typeof(items_jsonb) = 'array')
);

create index if not exists ix_research_briefing_sections_briefing_order
    on research_briefing_sections (research_briefing_id, section_order asc);

create table if not exists research_briefing_sources (
    id uuid primary key default gen_random_uuid(),
    research_briefing_id uuid not null references research_briefings(id) on delete cascade,
    source_order integer not null,
    title text not null,
    domain text not null,
    created_at timestamptz not null default now(),
    constraint uq_research_briefing_sources_order unique (research_briefing_id, source_order)
);

create index if not exists ix_research_briefing_sources_briefing_order
    on research_briefing_sources (research_briefing_id, source_order asc);
