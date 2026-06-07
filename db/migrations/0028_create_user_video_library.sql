create table if not exists user_video_library (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid not null references users(id) on delete cascade,
    media_source_id uuid not null references media_sources(id) on delete cascade,
    public_request_run_id uuid null references public_request_runs(id) on delete set null,
    workflow_id uuid null references workflows(id) on delete set null,
    transcript_id uuid null references transcripts(id) on delete set null,
    status text not null default 'queued',
    source_url text not null,
    completed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_user_video_library_user_source unique (requested_by_user_id, media_source_id),
    constraint ck_user_video_library_status check (status in ('queued', 'running', 'completed', 'failed')),
    constraint ck_user_video_library_source_url check (length(trim(source_url)) > 0)
);

create index if not exists ix_user_video_library_user_created_at
    on user_video_library (requested_by_user_id, created_at desc);

create index if not exists ix_user_video_library_source_status
    on user_video_library (media_source_id, status, created_at desc);

drop trigger if exists trg_user_video_library_updated_at on user_video_library;
create trigger trg_user_video_library_updated_at
before update on user_video_library
for each row
execute function set_updated_at();
