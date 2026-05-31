update sessions
set refresh_token_hash = @refresh_token_hash,
    expires_at = @expires_at,
    updated_at = @updated_at
where id = @session_id;
