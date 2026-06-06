create or replace function assign_default_user_role()
returns trigger
language plpgsql
as $$
begin
    insert into user_roles (user_id, role_id)
    select new.id, r.id
    from roles r
    where r.role_key = 'user'
    on conflict do nothing;

    return new;
end;
$$;

drop trigger if exists trg_users_assign_default_user_role on users;
create trigger trg_users_assign_default_user_role
after insert on users
for each row
execute function assign_default_user_role();
