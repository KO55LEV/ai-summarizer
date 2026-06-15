with inserted as (
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
    on conflict (user_id, source_type, source_id) do nothing
    returning id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at
)
select id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at
from inserted
union all
select id, user_id, source_type, source_id, estimated_credits, final_credits, status, reason, settled_at, released_at, expires_at, created_at, updated_at
from billing_reservations
where user_id = @user_id
  and source_type = @source_type
  and source_id = @source_id
  and not exists (select 1 from inserted)
limit 1;
