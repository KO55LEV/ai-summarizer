select id, requested_by_user_id, telegram_account_id, linked_at, revoked_at, created_at, updated_at
from user_telegram_accounts
where telegram_account_id = @telegram_account_id
  and revoked_at is null
order by created_at desc
limit 1;
