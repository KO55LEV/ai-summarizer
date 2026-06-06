delete from user_roles
where user_id = @user_id
  and role_id not in (
      select id
      from roles
      where role_key = any(@role_keys)
  );

insert into user_roles (user_id, role_id)
select @user_id, r.id
from roles r
where r.role_key = any(@role_keys)
on conflict do nothing;
