select id, requested_by_user_id, name, description, aliases_json::text as aliases_json, status, color, icon, is_default, created_at, updated_at
from projects
where id = @project_id;
