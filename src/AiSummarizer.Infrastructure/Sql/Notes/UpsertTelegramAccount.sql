insert into telegram_accounts (
    id,
    telegram_user_id,
    username,
    first_name,
    last_name,
    display_name,
    language_code,
    is_bot,
    last_seen_at,
    metadata_json,
    created_at,
    updated_at
)
values (
    @id,
    @telegram_user_id,
    @username,
    @first_name,
    @last_name,
    @display_name,
    @language_code,
    @is_bot,
    @last_seen_at,
    @metadata_json,
    @created_at,
    @updated_at
)
on conflict (telegram_user_id)
do update set
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    language_code = excluded.language_code,
    is_bot = excluded.is_bot,
    last_seen_at = excluded.last_seen_at,
    metadata_json = excluded.metadata_json,
    updated_at = excluded.updated_at
returning id, telegram_user_id, username, first_name, last_name, display_name, language_code, is_bot, last_seen_at, metadata_json::text as metadata_json, created_at, updated_at;
