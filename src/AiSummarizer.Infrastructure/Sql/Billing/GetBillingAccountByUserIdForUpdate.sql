select user_id, balance_credits, reserved_credits, created_at, updated_at
from billing_accounts
where user_id = @user_id
for update;

