insert into billing_ledger (
    id,
    user_id,
    reservation_id,
    entry_type,
    amount_credits,
    balance_delta_credits,
    reserved_delta_credits,
    balance_before_credits,
    balance_after_credits,
    reserved_before_credits,
    reserved_after_credits,
    source_type,
    source_id,
    reason,
    metadata_json,
    created_at
)
values (
    @id,
    @user_id,
    @reservation_id,
    @entry_type,
    @amount_credits,
    @balance_delta_credits,
    @reserved_delta_credits,
    @balance_before_credits,
    @balance_after_credits,
    @reserved_before_credits,
    @reserved_after_credits,
    @source_type,
    @source_id,
    @reason,
    @metadata_json,
    @created_at
)
returning id, user_id, reservation_id, entry_type, amount_credits, balance_delta_credits, reserved_delta_credits, balance_before_credits, balance_after_credits, reserved_before_credits, reserved_after_credits, source_type, source_id, reason, created_at;

