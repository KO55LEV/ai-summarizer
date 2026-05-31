update jobs
set cancel_requested_at = now(),
    updated_at = now()
where id = @job_id
  and cancel_requested_at is null
returning id;
