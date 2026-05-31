select id, requested_by_user_id, api_area, operation_name, http_method, request_path, source_id, source_provider, source_kind, external_source_id, source_url, workflow_id, transcript_id, request_json::text as request_json, response_json::text as response_json, status, error_code, error_message, started_at, finished_at, created_at, updated_at
from public_request_runs
where (@requested_by_user_id is null or requested_by_user_id = @requested_by_user_id)
  and (@operation_name is null or operation_name = @operation_name)
order by started_at desc, created_at desc
limit @limit_value offset @offset_value;
