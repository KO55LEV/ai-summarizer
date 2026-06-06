insert into user_telegram_accounts (
    id,
    requested_by_user_id,
    telegram_account_id,
    linked_at,
    revoked_at,
    created_at,
    updated_at
)
values (
    @id,
    @requested_by_user_id,
    @telegram_account_id,
    @linked_at,
    @revoked_at,
    @created_at,
    @updated_at
)
returning id, requested_by_user_id, telegram_account_id, linked_at, revoked_at, created_at, updated_at;
