update todo_items
set
    project_id = @project_id,
    bucket = @bucket,
    title = @title,
    description = @description,
    cadence = @cadence,
    status = @status,
    priority = @priority,
    due_at = @due_at,
    completed_at = @completed_at,
    sort_order = @sort_order,
    updated_at = @updated_at
where id = @id
returning id;
