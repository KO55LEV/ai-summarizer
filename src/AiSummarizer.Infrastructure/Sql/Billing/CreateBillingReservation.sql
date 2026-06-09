insert into billing_reservations (
    id,
    user_id,
    source_type,
    source_id,
    estimated_credits,
    final_credits,
    status,
    reason,
    settled_at,
    released_at,
    expires_at,
    created_at,
    updated_at
)
values (
    @id,
    @user_id,
    @source_type,
    @source_id,
    @estimated_credits,
    @final_credits,
    @status,
    @reason,
    @settled_at,
    @released_at,
    @expires_at,
    @created_at,
    @updated_at
)
returning id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at;

