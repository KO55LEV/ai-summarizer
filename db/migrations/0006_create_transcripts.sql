create table if not exists transcripts (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs(id) on delete cascade,
    source_job_id uuid null references jobs(id) on delete set null,
    source_file_path text not null,
    transcript_file_path text not null,
    language text not null,
    language_probability numeric(5,4) not null,
    duration_seconds numeric(12,2) not null,
    segment_count integer not null,
    word_count integer not null,
    character_count integer not null,
    transcript_text text not null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_transcripts_job unique (job_id),
    constraint ck_transcripts_language_probability check (language_probability >= 0 and language_probability <= 1),
    constraint ck_transcripts_duration check (duration_seconds >= 0),
    constraint ck_transcripts_counts check (segment_count >= 0 and word_count >= 0 and character_count >= 0)
);

create index if not exists ix_transcripts_source_job
    on transcripts (source_job_id);

create index if not exists ix_transcripts_language
    on transcripts (language, created_at desc);

create index if not exists ix_transcripts_created_at
    on transcripts (created_at desc);

create index if not exists ix_transcripts_search
    on transcripts using gin (to_tsvector('simple', transcript_text));

drop trigger if exists trg_transcripts_updated_at on transcripts;
create trigger trg_transcripts_updated_at
before update on transcripts
for each row
execute function set_updated_at();

create table if not exists transcript_segments (
    id uuid primary key default gen_random_uuid(),
    transcript_id uuid not null references transcripts(id) on delete cascade,
    segment_index integer not null,
    start_seconds numeric(12,2) not null,
    end_seconds numeric(12,2) not null,
    text_offset_start integer not null,
    text_offset_end integer not null,
    text text not null,
    speaker_label text null,
    word_count integer not null,
    character_count integer not null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint uq_transcript_segments_order unique (transcript_id, segment_index),
    constraint ck_transcript_segments_times check (start_seconds >= 0 and end_seconds >= start_seconds),
    constraint ck_transcript_segments_offsets check (text_offset_start >= 0 and text_offset_end >= text_offset_start),
    constraint ck_transcript_segments_counts check (word_count >= 0 and character_count >= 0)
);

create index if not exists ix_transcript_segments_transcript_order
    on transcript_segments (transcript_id, segment_index asc);

create index if not exists ix_transcript_segments_transcript_start
    on transcript_segments (transcript_id, start_seconds asc);

create index if not exists ix_transcript_segments_transcript_offset
    on transcript_segments (transcript_id, text_offset_start asc);

create index if not exists ix_transcript_segments_search
    on transcript_segments using gin (to_tsvector('simple', text));

create table if not exists transcript_artifacts (
    id uuid primary key default gen_random_uuid(),
    transcript_id uuid not null references transcripts(id) on delete cascade,
    job_id uuid null references jobs(id) on delete set null,
    artifact_type text not null,
    status text not null default 'ready',
    title text null,
    content_text text null,
    payload_json jsonb not null default '{}'::jsonb,
    result_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_transcript_artifacts_status check (status in ('queued', 'running', 'ready', 'failed')),
    constraint ck_transcript_artifacts_type check (length(trim(artifact_type)) > 0)
);

create index if not exists ix_transcript_artifacts_transcript_type
    on transcript_artifacts (transcript_id, artifact_type);

create index if not exists ix_transcript_artifacts_job
    on transcript_artifacts (job_id);

drop trigger if exists trg_transcript_artifacts_updated_at on transcript_artifacts;
create trigger trg_transcript_artifacts_updated_at
before update on transcript_artifacts
for each row
execute function set_updated_at();
