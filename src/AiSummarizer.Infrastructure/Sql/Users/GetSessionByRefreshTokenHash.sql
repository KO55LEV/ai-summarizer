select id, user_id, auth_identity_id, refresh_token_hash, device_name, user_agent, ip_address, expires_at, last_used_at, revoked_at, revoked_reason, replaced_by_session_id, created_at, updated_at
from sessions
where refresh_token_hash = @refresh_token_hash
limit 1;
