update jobs
set status = 'succeeded',
    result_json = @result_json,
    error_code = null,
    error_message = null,
    error_details_json = null,
    last_error_at = null,
    finished_at = now(),
    heartbeat_at = now(),
    locked_by = null,
    locked_at = null,
    locked_until = null,
    progress_percent = 100,
    progress_message = 'completed',
    updated_at = now()
where id = @job_id
  and locked_by = @worker_id
  and status = 'running'
returning id;
