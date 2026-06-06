update auth_identities
set provider_email = @email,
    provider_subject = case when provider = 'password' then @email else provider_subject end,
    updated_at = @updated_at
where user_id = @user_id;
