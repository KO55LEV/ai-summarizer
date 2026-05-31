update public_request_runs
set requested_by_user_id = @requested_by_user_id,
    api_area = @api_area,
    operation_name = @operation_name,
    http_method = @http_method,
    request_path = @request_path,
    source_id = @source_id,
    source_provider = @source_provider,
    source_kind = @source_kind,
    external_source_id = @external_source_id,
    source_url = @source_url,
    workflow_id = @workflow_id,
    transcript_id = @transcript_id,
    request_json = @request_json,
    response_json = @response_json,
    status = @status,
    error_code = @error_code,
    error_message = @error_message,
    started_at = @started_at,
    finished_at = @finished_at,
    updated_at = @updated_at
where id = @id
returning id, requested_by_user_id, api_area, operation_name, http_method, request_path, source_id, source_provider, source_kind, external_source_id, source_url, workflow_id, transcript_id, request_json::text as request_json, response_json::text as response_json, status, error_code, error_message, started_at, finished_at, created_at, updated_at;
