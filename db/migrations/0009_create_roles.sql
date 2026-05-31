create table if not exists roles (
    id uuid primary key default gen_random_uuid(),
    role_key text not null,
    display_name text not null,
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_roles_key_format check (length(trim(role_key)) > 0 and role_key = lower(role_key)),
    constraint ck_roles_display_name check (length(trim(display_name)) > 0),
    constraint ux_roles_key unique (role_key)
);

create index if not exists ix_roles_display_name
    on roles (display_name);

drop trigger if exists trg_roles_updated_at on roles;
create trigger trg_roles_updated_at
before update on roles
for each row
execute function set_updated_at();

create table if not exists user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    role_id uuid not null references roles(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint ux_user_roles_user_role unique (user_id, role_id)
);

create index if not exists ix_user_roles_user_id
    on user_roles (user_id);

create index if not exists ix_user_roles_role_id
    on user_roles (role_id);
