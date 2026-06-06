select
    u.id,
    u.email,
    u.display_name,
    u.avatar_url,
    u.locale,
    u.time_zone,
    u.status,
    u.email_verified_at,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    coalesce(array_agg(distinct r.role_key order by r.role_key) filter (where r.role_key is not null), '{}'::text[]) as roles,
    count(distinct s.id)::int as session_count
from users u
left join user_roles ur on ur.user_id = u.id
left join roles r on r.id = ur.role_id
left join sessions s on s.user_id = u.id and s.revoked_at is null and s.expires_at > now()
where u.id = @user_id
group by u.id;
