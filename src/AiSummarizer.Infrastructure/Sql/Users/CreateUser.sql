insert into users (email, display_name, avatar_url, locale, time_zone, status, email_verified_at, last_login_at, deleted_at)
values (@email, @display_name, @avatar_url, @locale, @time_zone, @status, @email_verified_at, @last_login_at, @deleted_at)
returning id, email, display_name, avatar_url, locale, time_zone, status, email_verified_at, last_login_at, deleted_at, created_at, updated_at;
