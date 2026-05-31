select id, parent_job_id, requested_by_user_id, job_type, priority, status, payload_json, result_json, error_code, error_message, error_details_json, attempt_count, max_attempts, available_at, locked_by, locked_at, locked_until, started_at, finished_at, last_error_at, heartbeat_at, progress_percent, progress_message, cancel_requested_at, created_at, updated_at
from jobs
where id = @job_id;
