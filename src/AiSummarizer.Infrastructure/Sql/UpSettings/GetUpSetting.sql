select setting_key, setting_json::text as setting_json, created_at, updated_at
from upsettings
where setting_key = @setting_key;
