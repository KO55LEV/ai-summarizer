select id, email, display_name, avatar_url, locale, time_zone, status, email_verified_at, last_login_at, deleted_at, created_at, updated_at
from users
where lower(email) = lower(@email) and deleted_at is null
limit 1;
