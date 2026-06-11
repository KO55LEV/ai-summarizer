select
    t.id,
    t.requested_by_user_id,
    t.project_id,
    p.name as project_name,
    t.color,
    t.bucket,
    t.title,
    t.description,
    t.cadence,
    t.status,
    t.priority,
    t.due_at,
    t.completed_at,
    t.sort_order,
    t.created_at,
    t.updated_at
from todo_items t
left join projects p on p.id = t.project_id
where (@requested_by_user_id is null or t.requested_by_user_id = @requested_by_user_id)
  and (@project_id is null or t.project_id = @project_id)
  and (@bucket is null or t.bucket = @bucket)
  and (@cadence is null or t.cadence = @cadence)
  and (@status is null or t.status = @status)
order by
    case t.bucket
        when 'today' then 0
        when 'next' then 1
        when 'later' then 2
        else 3
    end asc,
    case when t.status = 'done' then 1 else 0 end asc,
    t.sort_order asc,
    coalesce(t.due_at, 'infinity'::timestamptz) asc,
    t.created_at desc
limit @limit_value offset @offset_value;
