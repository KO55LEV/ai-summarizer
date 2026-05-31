update jobs
set heartbeat_at = now(),
    locked_until = now() + (@lease_seconds * interval '1 second'),
    progress_percent = coalesce(@progress_percent, progress_percent),
    progress_message = coalesce(@progress_message, progress_message),
    updated_at = now()
where id = @job_id
  and locked_by = @worker_id
  and status = 'running'
returning id;
