select id, user_id, reservation_id, entry_type, amount_credits, balance_delta_credits, reserved_delta_credits, balance_before_credits, balance_after_credits, reserved_before_credits, reserved_after_credits, source_type, source_id, reason, created_at
from billing_ledger
where user_id = @user_id
order by created_at desc
limit @limit_value offset @offset_value;

