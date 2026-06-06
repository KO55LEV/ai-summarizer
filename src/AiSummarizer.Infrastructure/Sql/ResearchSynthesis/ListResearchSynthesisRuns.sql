select id, research_topic_run_id, research_topic_run_phase_id, research_topic_id, research_ranking_run_id, status, reasoning_provider, model, prompt_version, input_hash, request_json::text as request_json, response_json::text as response_json, output_json::text as output_json, usage_json::text as usage_json, selected_document_count, started_at, finished_at, error_code, error_message, research_briefing_id, created_at, updated_at
from research_synthesis_runs
where research_topic_run_id = @research_topic_run_id
order by created_at asc
limit @limit_value offset @offset_value;
