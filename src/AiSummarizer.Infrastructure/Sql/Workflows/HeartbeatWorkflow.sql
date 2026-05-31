update workflows
set progress_percent = coalesce(@progress_percent, progress_percent),
    progress_message = coalesce(@progress_message, progress_message),
    heartbeat_at = now(),
    locked_until = now() + make_interval(secs => @lease_seconds),
    updated_at = now()
where id = @workflow_id
  and locked_by = @worker_id
returning id;
