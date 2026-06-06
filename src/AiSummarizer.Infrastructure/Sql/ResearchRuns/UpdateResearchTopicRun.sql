update research_topic_runs
set
    research_topic_id = @research_topic_id,
    requested_by_user_id = @requested_by_user_id,
    job_id = @job_id,
    status = @status,
    triggered_by = @triggered_by,
    started_at = @started_at,
    finished_at = @finished_at,
    next_retry_at = @next_retry_at,
    error_code = @error_code,
    error_message = @error_message,
    summary_preview = @summary_preview,
    updated_at = @updated_at
where id = @id;
