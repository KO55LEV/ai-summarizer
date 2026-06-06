select id, requested_by_user_id, name, description, aliases_json::text as aliases_json, status, color, icon, is_default, created_at, updated_at
from projects
where requested_by_user_id is not distinct from @requested_by_user_id
  and is_default = true
  and status <> 'deleted'
limit 1;
