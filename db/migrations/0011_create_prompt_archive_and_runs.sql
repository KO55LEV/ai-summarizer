create table if not exists prompt_archive (
    id uuid primary key default gen_random_uuid(),
    prompt_id uuid not null,
    archive_version integer not null,
    archive_reason text not null,
    prompt_key text not null,
    title text not null,
    description text null,
    workflow_type text null,
    provider text not null,
    model text not null,
    system_prompt text not null,
    user_prompt text not null,
    is_active boolean not null,
    archived_at timestamptz not null default now(),
    source_updated_at timestamptz not null,
    constraint ck_prompt_archive_reason check (archive_reason in ('created', 'updated', 'deleted')),
    constraint ck_prompt_archive_version check (archive_version > 0),
    constraint ux_prompt_archive_version unique (prompt_id, archive_version)
);

create index if not exists ix_prompt_archive_prompt_archived_at
    on prompt_archive (prompt_id, archived_at desc);

create index if not exists ix_prompt_archive_prompt_version
    on prompt_archive (prompt_id, archive_version desc);

create or replace function archive_prompt_snapshot()
returns trigger
language plpgsql
as $$
declare
    next_version integer;
begin
    if tg_op = 'INSERT' then
        select coalesce(max(archive_version), 0) + 1
        into next_version
        from prompt_archive
        where prompt_id = new.id;

        insert into prompt_archive (
            prompt_id,
            archive_version,
            archive_reason,
            prompt_key,
            title,
            description,
            workflow_type,
            provider,
            model,
            system_prompt,
            user_prompt,
            is_active,
            archived_at,
            source_updated_at
        )
        values (
            new.id,
            next_version,
            'created',
            new.prompt_key,
            new.title,
            new.description,
            new.workflow_type,
            new.provider,
            new.model,
            new.system_prompt,
            new.user_prompt,
            new.is_active,
            now(),
            new.updated_at
        );

        return new;
    elsif tg_op = 'UPDATE' then
        select coalesce(max(archive_version), 0) + 1
        into next_version
        from prompt_archive
        where prompt_id = old.id;

        insert into prompt_archive (
            prompt_id,
            archive_version,
            archive_reason,
            prompt_key,
            title,
            description,
            workflow_type,
            provider,
            model,
            system_prompt,
            user_prompt,
            is_active,
            archived_at,
            source_updated_at
        )
        values (
            old.id,
            next_version,
            'updated',
            old.prompt_key,
            old.title,
            old.description,
            old.workflow_type,
            old.provider,
            old.model,
            old.system_prompt,
            old.user_prompt,
            old.is_active,
            now(),
            old.updated_at
        );

        return new;
    elsif tg_op = 'DELETE' then
        select coalesce(max(archive_version), 0) + 1
        into next_version
        from prompt_archive
        where prompt_id = old.id;

        insert into prompt_archive (
            prompt_id,
            archive_version,
            archive_reason,
            prompt_key,
            title,
            description,
            workflow_type,
            provider,
            model,
            system_prompt,
            user_prompt,
            is_active,
            archived_at,
            source_updated_at
        )
        values (
            old.id,
            next_version,
            'deleted',
            old.prompt_key,
            old.title,
            old.description,
            old.workflow_type,
            old.provider,
            old.model,
            old.system_prompt,
            old.user_prompt,
            old.is_active,
            now(),
            old.updated_at
        );

        return old;
    end if;

    return null;
end;
$$;

drop trigger if exists trg_prompts_archive on prompts;
create trigger trg_prompts_archive
after insert or update or delete on prompts
for each row
execute function archive_prompt_snapshot();

create table if not exists prompt_runs (
    id uuid primary key default gen_random_uuid(),
    prompt_id uuid not null,
    workflow_id uuid null,
    step_key text null,
    prompt_key text not null,
    title text not null,
    workflow_type text null,
    provider text not null,
    model text not null,
    request_json jsonb not null,
    response_json jsonb null,
    status text not null default 'running',
    error_code text null,
    error_message text null,
    input_tokens integer null,
    output_tokens integer null,
    total_tokens integer null,
    duration_ms integer null,
    started_at timestamptz not null default now(),
    finished_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_prompt_runs_status check (status in ('running', 'succeeded', 'failed', 'cancelled')),
    constraint ck_prompt_runs_tokens check (
        (input_tokens is null or input_tokens >= 0)
        and (output_tokens is null or output_tokens >= 0)
        and (total_tokens is null or total_tokens >= 0)
    ),
    constraint ck_prompt_runs_duration check (duration_ms is null or duration_ms >= 0)
);

create index if not exists ix_prompt_runs_prompt_created_at
    on prompt_runs (prompt_id, created_at desc);

create index if not exists ix_prompt_runs_workflow_created_at
    on prompt_runs (workflow_id, created_at desc);

create index if not exists ix_prompt_runs_status_created_at
    on prompt_runs (status, created_at desc);

drop trigger if exists trg_prompt_runs_updated_at on prompt_runs;
create trigger trg_prompt_runs_updated_at
before update on prompt_runs
for each row
execute function set_updated_at();
