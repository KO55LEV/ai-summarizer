update users
set email = @email,
    display_name = @display_name,
    avatar_url = @avatar_url,
    locale = @locale,
    time_zone = @time_zone,
    status = @status,
    deleted_at = case when @status = 'deleted' then coalesce(deleted_at, now()) else null end,
    updated_at = @updated_at
where id = @user_id;
