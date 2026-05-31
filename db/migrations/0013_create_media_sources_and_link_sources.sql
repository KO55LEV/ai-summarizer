create table if not exists media_sources (
    id uuid primary key default gen_random_uuid(),
    source_provider text not null,
    source_kind text not null,
    external_source_id text not null,
    canonical_url text not null,
    original_url text not null,
    duration_seconds numeric(12,2) null,
    native_transcript_available boolean null,
    native_transcript_checked_at timestamptz null,
    native_transcript_language text null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_media_sources_identity unique (source_provider, source_kind, external_source_id),
    constraint ck_media_sources_duration check (duration_seconds is null or duration_seconds >= 0)
);

create index if not exists ix_media_sources_provider_kind_created_at
    on media_sources (source_provider, source_kind, created_at desc);

drop trigger if exists trg_media_sources_updated_at on media_sources;
create trigger trg_media_sources_updated_at
before update on media_sources
for each row
execute function set_updated_at();

alter table workflows
    add column if not exists source_id uuid null references media_sources(id) on delete set null;

create index if not exists ix_workflows_source_id_created_at
    on workflows (source_id, created_at desc);

alter table transcripts
    add column if not exists source_id uuid null references media_sources(id) on delete set null;

create index if not exists ix_transcripts_source_id_created_at
    on transcripts (source_id, created_at desc);
