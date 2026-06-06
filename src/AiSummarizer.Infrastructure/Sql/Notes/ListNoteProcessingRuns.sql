select id, note_id, job_id, stage, status, provider, model, prompt_version, input_hash,
       request_json::text as request_json, response_json::text as response_json, output_json::text as output_json,
       usage_json::text as usage_json, metrics_json::text as metrics_json,
       error_code, error_message, started_at, finished_at, created_at, updated_at
from note_processing_runs
where note_id = @note_id
order by created_at desc
limit @limit_value offset @offset_value;
