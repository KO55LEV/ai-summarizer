update billing_accounts
set balance_credits = @balance_credits,
    reserved_credits = @reserved_credits,
    updated_at = @updated_at
where user_id = @user_id
returning user_id, balance_credits, reserved_credits, created_at, updated_at;

