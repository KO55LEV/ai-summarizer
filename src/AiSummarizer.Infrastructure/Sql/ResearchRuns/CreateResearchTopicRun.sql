insert into research_topic_runs (
    id,
    research_topic_id,
    requested_by_user_id,
    job_id,
    workflow_id,
    status,
    triggered_by,
    started_at,
    finished_at,
    next_retry_at,
    error_code,
    error_message,
    summary_preview,
    created_at,
    updated_at
)
values (
    @id,
    @research_topic_id,
    @requested_by_user_id,
    @job_id,
    @workflow_id,
    @status,
    @triggered_by,
    @started_at,
    @finished_at,
    @next_retry_at,
    @error_code,
    @error_message,
    @summary_preview,
    @created_at,
    @updated_at
)
returning id, research_topic_id, requested_by_user_id, job_id, workflow_id, status, triggered_by, started_at, finished_at, next_retry_at, error_code, error_message, summary_preview, created_at, updated_at;
