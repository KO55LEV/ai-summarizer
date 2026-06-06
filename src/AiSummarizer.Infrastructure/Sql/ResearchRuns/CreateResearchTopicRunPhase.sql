insert into research_topic_run_phases (
    id,
    research_topic_run_id,
    phase_key,
    status,
    attempt_count,
    started_at,
    finished_at,
    error_code,
    error_message,
    metrics_json,
    created_at,
    updated_at
)
values (
    @id,
    @research_topic_run_id,
    @phase_key,
    @status,
    @attempt_count,
    @started_at,
    @finished_at,
    @error_code,
    @error_message,
    @metrics_json,
    @created_at,
    @updated_at
)
returning id, research_topic_run_id, phase_key, status, attempt_count, started_at, finished_at, error_code, error_message, metrics_json, created_at, updated_at;
