insert into todo_items (
    id,
    requested_by_user_id,
    project_id,
    color,
    bucket,
    title,
    description,
    cadence,
    status,
    priority,
    due_at,
    completed_at,
    sort_order,
    created_at,
    updated_at
)
values (
    @id,
    @requested_by_user_id,
    @project_id,
    @color,
    @bucket,
    @title,
    @description,
    @cadence,
    @status,
    @priority,
    @due_at,
    @completed_at,
    @sort_order,
    @created_at,
    @updated_at
)
returning id;
