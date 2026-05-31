select id, prompt_id, workflow_id, step_key, prompt_key, title, workflow_type, provider, model, request_json::text as request_json, response_json::text as response_json, status, error_code, error_message, input_tokens, output_tokens, total_tokens, duration_ms, started_at, finished_at, created_at, updated_at
from prompt_runs
where prompt_id = @prompt_id
order by created_at desc
limit @limit_value offset @offset_value;
