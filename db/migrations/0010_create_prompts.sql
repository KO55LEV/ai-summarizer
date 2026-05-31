create table if not exists prompts (
    id uuid primary key default gen_random_uuid(),
    prompt_key text not null,
    title text not null,
    description text null,
    workflow_type text null,
    provider text not null,
    model text not null,
    system_prompt text not null,
    user_prompt text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_prompts_key_format check (length(trim(prompt_key)) > 0 and prompt_key = lower(prompt_key)),
    constraint ck_prompts_title check (length(trim(title)) > 0),
    constraint ck_prompts_provider check (length(trim(provider)) > 0),
    constraint ck_prompts_model check (length(trim(model)) > 0),
    constraint ck_prompts_system_prompt check (length(trim(system_prompt)) > 0),
    constraint ck_prompts_user_prompt check (length(trim(user_prompt)) > 0),
    constraint ux_prompts_key unique (prompt_key)
);

create index if not exists ix_prompts_workflow_type
    on prompts (workflow_type);

create index if not exists ix_prompts_provider_model
    on prompts (provider, model);

create index if not exists ix_prompts_active
    on prompts (is_active, workflow_type, provider, model)
    where is_active = true;

drop trigger if exists trg_prompts_updated_at on prompts;
create trigger trg_prompts_updated_at
before update on prompts
for each row
execute function set_updated_at();
