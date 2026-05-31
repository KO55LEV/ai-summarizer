insert into workflow_steps (
    id,
    workflow_id,
    step_order,
    step_key,
    step_type,
    job_id,
    status,
    input_json,
    output_json,
    error_code,
    error_message,
    started_at,
    finished_at,
    created_at,
    updated_at
)
values (
    @id,
    @workflow_id,
    @step_order,
    @step_key,
    @step_type,
    @job_id,
    @status,
    @input_json,
    @output_json,
    @error_code,
    @error_message,
    @started_at,
    @finished_at,
    @created_at,
    @updated_at
)
returning id, workflow_id, step_order, step_key, step_type, job_id, status, input_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at;
