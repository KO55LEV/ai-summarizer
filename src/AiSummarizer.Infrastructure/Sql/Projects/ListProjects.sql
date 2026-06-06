select id, requested_by_user_id, name, description, aliases_json::text as aliases_json, status, color, icon, is_default, created_at, updated_at
from projects
where (@requested_by_user_id is null or requested_by_user_id = @requested_by_user_id)
  and status <> 'deleted'
order by is_default desc, created_at desc
limit @limit_value offset @offset_value;
