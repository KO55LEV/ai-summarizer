create table if not exists search_provider_keys (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    api_key text not null,
    quota_per_month integer not null default 0,
    is_active boolean not null default true,
    note text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_search_provider_keys_quota_per_month check (quota_per_month >= 0)
);

create index if not exists ix_search_provider_keys_provider_active
    on search_provider_keys (provider, is_active, created_at desc);

drop trigger if exists trg_search_provider_keys_updated_at on search_provider_keys;
create trigger trg_search_provider_keys_updated_at
before update on search_provider_keys
for each row
execute function set_updated_at();

create table if not exists search_provider_logs (
    id uuid primary key default gen_random_uuid(),
    search_provider_key_id uuid null references search_provider_keys(id) on delete set null,
    job_id uuid null,
    provider text not null,
    status_code integer not null,
    request_payload text not null default '{}',
    created_at timestamptz not null default now()
);

create index if not exists ix_search_provider_logs_key_created_at
    on search_provider_logs (search_provider_key_id, created_at desc);

create index if not exists ix_search_provider_logs_provider_created_at
    on search_provider_logs (provider, created_at desc);
