update sessions
set revoked_at = @revoked_at,
    revoked_reason = @reason
where id = @session_id;
