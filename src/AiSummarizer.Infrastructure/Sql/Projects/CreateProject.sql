insert into projects (
    id,
    requested_by_user_id,
    name,
    description,
    aliases_json,
    status,
    color,
    icon,
    is_default,
    created_at,
    updated_at
)
values (
    @id,
    @requested_by_user_id,
    @name,
    @description,
    @aliases_json,
    @status,
    @color,
    @icon,
    @is_default,
    @created_at,
    @updated_at
)
returning id, requested_by_user_id, name, description, aliases_json::text as aliases_json, status, color, icon, is_default, created_at, updated_at;
