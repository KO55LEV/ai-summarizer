select ai.id, ai.user_id, ai.provider, ai.provider_subject, ai.provider_email, ai.password_hash, ai.last_used_at, ai.created_at, ai.updated_at
from auth_identities ai
join users u on u.id = ai.user_id
where ai.provider = @provider
  and ai.provider_subject = @provider_subject
  and u.deleted_at is null
limit 1;
