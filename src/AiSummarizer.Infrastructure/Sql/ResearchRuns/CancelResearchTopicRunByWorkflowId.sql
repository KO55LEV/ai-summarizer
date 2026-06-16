update research_topic_runs
set status = 'cancelled',
    finished_at = coalesce(finished_at, @finished_at),
    next_retry_at = null,
    error_code = 'cancelled',
    error_message = @reason,
    updated_at = @updated_at
where workflow_id = @workflow_id
  and status in ('queued', 'running')
returning id;
