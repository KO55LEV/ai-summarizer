create table if not exists research_content_runs (
    id uuid primary key default gen_random_uuid(),
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_run_phase_id uuid null references research_topic_run_phases(id) on delete set null,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    status text not null default 'queued',
    started_at timestamptz null,
    finished_at timestamptz null,
    error_code text null,
    error_message text null,
    metrics_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_research_content_runs_status check (status in ('queued', 'running', 'succeeded', 'failed'))
);

create index if not exists ix_research_content_runs_topic_run
    on research_content_runs (research_topic_run_id, created_at desc);

drop trigger if exists trg_research_content_runs_updated_at on research_content_runs;
create trigger trg_research_content_runs_updated_at
before update on research_content_runs
for each row
execute function set_updated_at();

create table if not exists research_content_items (
    id uuid primary key default gen_random_uuid(),
    research_content_run_id uuid not null references research_content_runs(id) on delete cascade,
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    source_key text not null,
    source_url text not null,
    canonical_url text null,
    title text not null,
    author_name text null,
    published_at timestamptz null,
    fetch_method text not null,
    content_type text not null,
    status text not null default 'queued',
    content_hash text null,
    raw_text text null,
    raw_storage_path text null,
    raw_metadata_json jsonb not null default '{}'::jsonb,
    error_code text null,
    error_message text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_research_content_items_status check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped'))
);

create index if not exists ix_research_content_items_topic_run
    on research_content_items (research_topic_run_id, created_at desc);

create index if not exists ix_research_content_items_content_run
    on research_content_items (research_content_run_id, created_at desc);

create index if not exists ix_research_content_items_source_url
    on research_content_items (source_url);

drop trigger if exists trg_research_content_items_updated_at on research_content_items;
create trigger trg_research_content_items_updated_at
before update on research_content_items
for each row
execute function set_updated_at();

create table if not exists research_content_assets (
    id uuid primary key default gen_random_uuid(),
    research_content_item_id uuid not null references research_content_items(id) on delete cascade,
    asset_type text not null,
    storage_path text not null,
    mime_type text null,
    size_bytes bigint null,
    checksum text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_research_content_assets_item
    on research_content_assets (research_content_item_id, created_at desc);

drop trigger if exists trg_research_content_assets_updated_at on research_content_assets;
create trigger trg_research_content_assets_updated_at
before update on research_content_assets
for each row
execute function set_updated_at();
