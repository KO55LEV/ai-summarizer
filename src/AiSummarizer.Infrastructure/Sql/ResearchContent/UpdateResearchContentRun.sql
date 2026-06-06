update research_content_runs
set
    research_topic_run_id = @research_topic_run_id,
    research_topic_run_phase_id = @research_topic_run_phase_id,
    research_topic_id = @research_topic_id,
    status = @status,
    started_at = @started_at,
    finished_at = @finished_at,
    error_code = @error_code,
    error_message = @error_message,
    metrics_json = @metrics_json,
    updated_at = @updated_at
where id = @id;
