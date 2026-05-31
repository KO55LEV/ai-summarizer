-- Edit these values before running.
with upserted_roles as (
    insert into roles (role_key, display_name, description)
    values
        ('admin', 'Admin', 'Full access to the system.'),
        ('user', 'User', 'Standard application access.')
    on conflict (role_key)
    do update set
        display_name = excluded.display_name,
        description = excluded.description
    returning id, role_key
),
upserted_user as (
    insert into users (id, email, display_name, status, email_verified_at)
    values (
        gen_random_uuid(),
        'test@test.com',
        'Test User',
        'active',
        now()
    )
    on conflict (lower(email)) where deleted_at is null
    do update set
        display_name = excluded.display_name,
        status = 'active',
        email_verified_at = coalesce(users.email_verified_at, excluded.email_verified_at)
    returning id, email
), 
admin_role as (
    select id
    from upserted_roles
    where role_key = 'admin'
),
assigned_role as (
    insert into user_roles (user_id, role_id)
    select upserted_user.id, admin_role.id
    from upserted_user
    cross join admin_role
    on conflict do nothing
    returning user_id, role_id
)
select upserted_user.id as user_id, upserted_user.email, admin_role.id as admin_role_id
from upserted_user
cross join admin_role;
