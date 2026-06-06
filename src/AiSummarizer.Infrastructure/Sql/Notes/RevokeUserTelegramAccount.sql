update user_telegram_accounts
set revoked_at = @revoked_at,
    updated_at = now()
where id = @id;
