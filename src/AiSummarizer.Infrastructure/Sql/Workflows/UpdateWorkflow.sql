update workflows
set requested_by_user_id = @requested_by_user_id,
    workflow_type = @workflow_type,
    status = @status,
    input_json = @input_json,
    result_json = @result_json,
    current_step_key = @current_step_key,
    error_code = @error_code,
    error_message = @error_message,
    attempt_count = @attempt_count,
    max_attempts = @max_attempts,
    available_at = @available_at,
    locked_by = @locked_by,
    locked_at = @locked_at,
    locked_until = @locked_until,
    started_at = @started_at,
    finished_at = @finished_at,
    heartbeat_at = @heartbeat_at,
    progress_percent = @progress_percent,
    progress_message = @progress_message,
    updated_at = @updated_at
where id = @id
returning id, requested_by_user_id, workflow_type, status, input_json, result_json, current_step_key, error_code, error_message, attempt_count, max_attempts, available_at, locked_by, locked_at, locked_until, started_at, finished_at, heartbeat_at, progress_percent, progress_message, created_at, updated_at;
