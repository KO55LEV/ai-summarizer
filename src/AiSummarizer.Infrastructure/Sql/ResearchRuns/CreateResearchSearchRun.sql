insert into research_search_runs (
    id,
    research_topic_run_id,
    research_topic_run_phase_id,
    research_topic_id,
    source_key,
    planner_version,
    query_count,
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
    @source_key,
    @planner_version,
    @query_count,
    @status,
    @started_at,
    @finished_at,
    @error_code,
    @error_message,
    @metrics_json,
    @created_at,
    @updated_at
)
returning id, research_topic_run_id, research_topic_run_phase_id, research_topic_id, source_key, planner_version, query_count, status, started_at, finished_at, error_code, error_message, metrics_json, created_at, updated_at;
