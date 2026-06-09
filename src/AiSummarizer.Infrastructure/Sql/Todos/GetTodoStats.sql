select
    count(*)::int as total_count,
    count(*) filter (where status = 'open')::int as open_count,
    count(*) filter (where status = 'doing')::int as doing_count,
    count(*) filter (where status = 'blocked')::int as blocked_count,
    count(*) filter (where status = 'done')::int as done_count,
    count(*) filter (
        where due_at is not null
          and due_at::date = current_date
          and status not in ('done', 'archived')
    )::int as due_today_count,
    count(*) filter (
        where due_at is not null
          and due_at < now()
          and status not in ('done', 'archived')
    )::int as overdue_count,
    count(*) filter (where project_id is not null)::int as project_linked_count,
    count(*) filter (where cadence = 'target')::int as target_count
from todo_items
where (@requested_by_user_id is null or requested_by_user_id = @requested_by_user_id)
  and (@project_id is null or project_id = @project_id)
  and (@bucket is null or bucket = @bucket)
  and (@cadence is null or cadence = @cadence)
  and (@status is null or status = @status);
