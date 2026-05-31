update workflow_steps
set step_order = @step_order,
    step_key = @step_key,
    step_type = @step_type,
    job_id = @job_id,
    status = @status,
    input_json = @input_json,
    output_json = @output_json,
    error_code = @error_code,
    error_message = @error_message,
    started_at = @started_at,
    finished_at = @finished_at,
    updated_at = @updated_at
where id = @id
returning id, workflow_id, step_order, step_key, step_type, job_id, status, input_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at;
