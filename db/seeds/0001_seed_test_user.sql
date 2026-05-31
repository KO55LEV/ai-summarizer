-- Edit these values before running.
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
returning id, email;
