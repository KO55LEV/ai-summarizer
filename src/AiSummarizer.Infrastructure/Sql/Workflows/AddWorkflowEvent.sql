insert into workflow_events (
    id,
    workflow_id,
    step_key,
    level,
    message,
    context_json,
    created_at
)
values (
    gen_random_uuid(),
    @workflow_id,
    @step_key,
    @level,
    @message,
    @context_json,
    now()
)
returning id, workflow_id, step_key, level, message, context_json, created_at;
