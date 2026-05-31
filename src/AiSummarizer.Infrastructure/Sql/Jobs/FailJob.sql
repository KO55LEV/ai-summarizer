update jobs
set status = case
        when @dead_letter then 'dead'
        when attempt_count >= max_attempts then 'dead'
        else 'retry_wait'
    end,
    error_code = @error_code,
    error_message = @error_message,
    error_details_json = @error_details_json,
    last_error_at = now(),
    finished_at = case
        when @dead_letter or attempt_count >= max_attempts then now()
        else finished_at
    end,
    available_at = case
        when @dead_letter or attempt_count >= max_attempts then available_at
        else now() + (@retry_seconds * interval '1 second')
    end,
    locked_by = null,
    locked_at = null,
    locked_until = null,
    heartbeat_at = now(),
    updated_at = now()
where id = @job_id
  and locked_by = @worker_id
  and status = 'running'
returning id;
