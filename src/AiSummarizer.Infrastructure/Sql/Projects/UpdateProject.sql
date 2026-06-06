update projects
set requested_by_user_id = @requested_by_user_id,
    name = @name,
    description = @description,
    aliases_json = @aliases_json,
    status = @status,
    color = @color,
    icon = @icon,
    is_default = @is_default,
    created_at = @created_at,
    updated_at = @updated_at
where id = @id
returning id, requested_by_user_id, name, description, aliases_json::text as aliases_json, status, color, icon, is_default, created_at, updated_at;
