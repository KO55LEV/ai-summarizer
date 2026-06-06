insert into research_content_runs (
    id,
    research_topic_run_id,
    research_topic_run_phase_id,
    research_topic_id,
    status,
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
    @research_topic_run_phase_id,
    @research_topic_id,
    @status,
    @started_at,
    @finished_at,
    @error_code,
    @error_message,
    @metrics_json,
    @created_at,
    @updated_at
)
returning id, research_topic_run_id, research_topic_run_phase_id, research_topic_id, status, started_at, finished_at, error_code, error_message, metrics_json, created_at, updated_at;
