update notes
set requested_by_user_id = @requested_by_user_id,
    project_id = @project_id,
    title = @title,
    status = @status,
    source_channel = @source_channel,
    input_kind = @input_kind,
    primary_language = @primary_language,
    current_text_version_id = @current_text_version_id,
    summary = @summary,
    created_at = @created_at,
    updated_at = @updated_at
where id = @id
returning id, requested_by_user_id, project_id, title, status, source_channel, input_kind, primary_language, current_text_version_id, summary, created_at, updated_at;
