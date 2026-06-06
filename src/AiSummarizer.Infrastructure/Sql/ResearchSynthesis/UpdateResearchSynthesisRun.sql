update research_synthesis_runs
set
    research_topic_run_id = @research_topic_run_id,
    research_topic_run_phase_id = @research_topic_run_phase_id,
    research_topic_id = @research_topic_id,
    research_ranking_run_id = @research_ranking_run_id,
    status = @status,
    reasoning_provider = @reasoning_provider,
    model = @model,
    prompt_version = @prompt_version,
    input_hash = @input_hash,
    request_json = @request_json,
    response_json = @response_json,
    output_json = @output_json,
    usage_json = @usage_json,
    selected_document_count = @selected_document_count,
    started_at = @started_at,
    finished_at = @finished_at,
    error_code = @error_code,
    error_message = @error_message,
    research_briefing_id = @research_briefing_id,
    updated_at = @updated_at
where id = @id;
