insert into auth_identities (user_id, provider, provider_subject, provider_email, password_hash, last_used_at)
values (@user_id, @provider, @provider_subject, @provider_email, @password_hash, @last_used_at)
returning id, user_id, provider, provider_subject, provider_email, password_hash, last_used_at, created_at, updated_at;
