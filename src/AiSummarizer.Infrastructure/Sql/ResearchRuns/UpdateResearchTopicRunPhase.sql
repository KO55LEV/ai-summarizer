update research_topic_run_phases
set
    research_topic_run_id = @research_topic_run_id,
    phase_key = @phase_key,
    status = @status,
    attempt_count = @attempt_count,
    started_at = @started_at,
    finished_at = @finished_at,
    error_code = @error_code,
    error_message = @error_message,
    metrics_json = @metrics_json,
    updated_at = @updated_at
where id = @id;
