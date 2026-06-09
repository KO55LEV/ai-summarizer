select
    t.id,
    t.requested_by_user_id,
    t.project_id,
    p.name as project_name,
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
where t.id = @todo_id;
