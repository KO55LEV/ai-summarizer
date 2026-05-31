select id, requested_by_user_id, api_area, operation_name, http_method, request_path, source_id, source_provider, source_kind, external_source_id, source_url, workflow_id, transcript_id, request_json::text as request_json, response_json::text as response_json, status, error_code, error_message, started_at, finished_at, created_at, updated_at
from public_request_runs
where id = @request_run_id;
