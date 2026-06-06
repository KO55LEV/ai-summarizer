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
where u.deleted_at is null
  and (
      coalesce(@search, '') = ''
      or lower(u.email) like '%' || lower(@search) || '%'
      or lower(coalesce(u.display_name, '')) like '%' || lower(@search) || '%'
      or lower(coalesce(u.locale, '')) like '%' || lower(@search) || '%'
      or lower(coalesce(u.time_zone, '')) like '%' || lower(@search) || '%'
      or exists (
          select 1
          from user_roles ur2
          join roles r2 on r2.id = ur2.role_id
          where ur2.user_id = u.id
            and lower(r2.role_key) like '%' || lower(@search) || '%'
      )
  )
group by u.id
order by u.created_at desc
limit @limit offset @offset;
