update research_ranking_runs
set
    research_topic_run_id = @research_topic_run_id,
    research_topic_run_phase_id = @research_topic_run_phase_id,
    research_topic_id = @research_topic_id,
    status = @status,
    scoring_version = @scoring_version,
    total_documents = @total_documents,
    selected_documents = @selected_documents,
    started_at = @started_at,
    finished_at = @finished_at,
    error_code = @error_code,
    error_message = @error_message,
    metrics_json = @metrics_json,
    updated_at = @updated_at
where id = @id;
