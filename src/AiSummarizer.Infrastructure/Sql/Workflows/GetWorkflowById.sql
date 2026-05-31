select id, requested_by_user_id, workflow_type, status, input_json, result_json, current_step_key, error_code, error_message, attempt_count, max_attempts, available_at, locked_by, locked_at, locked_until, started_at, finished_at, heartbeat_at, progress_percent, progress_message, created_at, updated_at
from workflows
where id = @workflow_id;
