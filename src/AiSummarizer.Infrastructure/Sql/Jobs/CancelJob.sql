update jobs
set status = 'cancelled',
    error_code = @reason,
    error_message = 'Job was cancelled.',
    finished_at = now(),
    locked_by = null,
    locked_at = null,
    locked_until = null,
    heartbeat_at = now(),
    updated_at = now()
where id = @job_id
  and locked_by = @worker_id
  and status = 'running'
returning id;
