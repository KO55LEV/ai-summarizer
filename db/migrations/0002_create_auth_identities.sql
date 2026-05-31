create table if not exists auth_identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    provider_subject text not null,
    provider_email text null,
    password_hash text null,
    last_used_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_auth_identities_provider check (provider in ('password', 'google', 'facebook')),
    constraint ck_auth_identities_password_hash check (
        (provider = 'password' and password_hash is not null)
        or (provider <> 'password' and password_hash is null)
    ),
    constraint uq_auth_identities_provider_subject unique (provider, provider_subject)
);

create unique index if not exists ux_auth_identities_user_provider
    on auth_identities (user_id, provider);

drop trigger if exists trg_auth_identities_updated_at on auth_identities;
create trigger trg_auth_identities_updated_at
before update on auth_identities
for each row
execute function set_updated_at();

