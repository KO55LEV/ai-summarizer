create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    auth_identity_id uuid null references auth_identities(id) on delete set null,
    refresh_token_hash text not null,
    device_name text null,
    user_agent text null,
    ip_address inet null,
    expires_at timestamptz not null,
    last_used_at timestamptz null,
    revoked_at timestamptz null,
    revoked_reason text null,
    replaced_by_session_id uuid null references sessions(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_sessions_revocation_reason check (
        (revoked_at is null and revoked_reason is null)
        or (revoked_at is not null and revoked_reason is not null)
    )
);

create unique index if not exists ux_sessions_refresh_token_hash
    on sessions (refresh_token_hash);

create index if not exists ix_sessions_user_active
    on sessions (user_id, expires_at desc)
    where revoked_at is null;

create index if not exists ix_sessions_expires_at
    on sessions (expires_at);

drop trigger if exists trg_sessions_updated_at on sessions;
create trigger trg_sessions_updated_at
before update on sessions
for each row
execute function set_updated_at();

