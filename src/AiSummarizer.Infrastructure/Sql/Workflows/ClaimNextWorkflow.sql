with next_workflow as (
    select id
    from workflows
    where status in ('queued', 'waiting')
      and (locked_until is null or locked_until <= now())
    order by available_at asc, created_at asc
    for update skip locked
    limit 1
)
update workflows as w
set status = 'running',
    locked_by = @worker_id,
    locked_at = now(),
    locked_until = now() + make_interval(secs => @lease_seconds),
    heartbeat_at = now(),
    updated_at = now()
from next_workflow
where w.id = next_workflow.id
returning w.id, w.requested_by_user_id, w.workflow_type, w.status, w.input_json, w.result_json, w.current_step_key, w.error_code, w.error_message, w.attempt_count, w.max_attempts, w.available_at, w.locked_by, w.locked_at, w.locked_until, w.started_at, w.finished_at, w.heartbeat_at, w.progress_percent, w.progress_message, w.created_at, w.updated_at;
