create table if not exists app_states (
    state_key text primary key,
    state_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_app_states_state_key check (length(trim(state_key)) > 0)
);

drop trigger if exists trg_app_states_updated_at on app_states;
create trigger trg_app_states_updated_at
before update on app_states
for each row
execute function set_updated_at();
