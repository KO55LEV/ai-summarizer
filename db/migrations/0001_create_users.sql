create extension if not exists pgcrypto;

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    display_name text null,
    avatar_url text null,
    locale text null,
    time_zone text null,
    status text not null default 'active',
    email_verified_at timestamptz null,
    last_login_at timestamptz null,
    deleted_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_users_status check (status in ('active', 'disabled', 'deleted'))
);

create unique index if not exists ux_users_email_active
    on users (lower(email))
    where deleted_at is null;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row
execute function set_updated_at();

