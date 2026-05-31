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
    attempt_count = j.attempt_count + 1
from next_job
where j.id = next_job.id
returning j.id, j.parent_job_id, j.requested_by_user_id, j.job_type, j.priority, j.status, j.payload_json, j.result_json, j.error_code, j.error_message, j.error_details_json, j.attempt_count, j.max_attempts, j.available_at, j.locked_by, j.locked_at, j.locked_until, j.started_at, j.finished_at, j.last_error_at, j.heartbeat_at, j.progress_percent, j.progress_message, j.cancel_requested_at, j.created_at, j.updated_at;
