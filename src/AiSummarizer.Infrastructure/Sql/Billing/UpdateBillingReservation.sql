update billing_reservations
set user_id = @user_id,
    source_type = @source_type,
    source_id = @source_id,
    estimated_credits = @estimated_credits,
    final_credits = @final_credits,
    status = @status,
    reason = @reason,
    settled_at = @settled_at,
    released_at = @released_at,
    expires_at = @expires_at,
    updated_at = @updated_at
where id = @id
returning id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at;

