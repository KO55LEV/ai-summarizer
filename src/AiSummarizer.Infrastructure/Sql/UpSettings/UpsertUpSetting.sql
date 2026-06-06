insert into upsettings (
    setting_key,
    setting_json
)
values (
    @setting_key,
    @setting_json
)
on conflict (setting_key) do update
set setting_json = excluded.setting_json
returning setting_key, setting_json::text as setting_json, created_at, updated_at;
