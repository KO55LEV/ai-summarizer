update auth_identities
set last_used_at = @last_used_at
where id = @auth_identity_id;
