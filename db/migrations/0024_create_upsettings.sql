create table if not exists upsettings (
    setting_key text primary key,
    setting_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_upsettings_setting_key check (length(trim(setting_key)) > 0)
);

drop trigger if exists trg_upsettings_updated_at on upsettings;
create trigger trg_upsettings_updated_at
before update on upsettings
for each row
execute function set_updated_at();
