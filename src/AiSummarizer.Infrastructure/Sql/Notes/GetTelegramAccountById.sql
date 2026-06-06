select id, telegram_user_id, username, first_name, last_name, display_name, language_code, is_bot, last_seen_at, metadata_json::text as metadata_json, created_at, updated_at
from telegram_accounts
where id = @telegram_account_id;
