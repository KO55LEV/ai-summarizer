select id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at
from billing_reservations
where user_id = @user_id
  and source_type = @source_type
  and source_id = @source_id;
