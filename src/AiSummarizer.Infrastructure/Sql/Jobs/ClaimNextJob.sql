with next_job as (
    select id
    from jobs
    where status in ('queued', 'retry_wait')
      and available_at <= now()
      and attempt_count < max_attempts
      and (locked_until is null or locked_until <= now())
      and cancel_requested_at is null
    order by priority asc, available_at asc, created_at asc
    for update skip locked
    limit 1
)
update jobs j
set status = 'running',
    locked_by = @worker_id,
    locked_at = now(),
    heartbeat_at = now(),
    locked_until = now() + (@lease_seconds * interval '1 second'),
    started_at = coalesce(started_at, now()),
    updated_at = now(),
    attempt_count = attempt_count + 1
from next_job
where j.id = next_job.id
returning id, parent_job_id, requested_by_user_id, job_type, priority, status, payload_json, result_json, error_code, error_message, error_details_json, attempt_count, max_attempts, available_at, locked_by, locked_at, locked_until, started_at, finished_at, last_error_at, heartbeat_at, progress_percent, progress_message, cancel_requested_at, created_at, updated_at;
