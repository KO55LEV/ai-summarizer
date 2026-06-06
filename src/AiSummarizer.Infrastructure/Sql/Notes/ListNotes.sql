select id, requested_by_user_id, project_id, title, status, source_channel, input_kind, primary_language, current_text_version_id, summary, created_at, updated_at
from notes
where (@requested_by_user_id is null or requested_by_user_id = @requested_by_user_id)
  and (@project_id is null or project_id = @project_id)
  and status <> 'deleted'
order by created_at desc
limit @limit_value offset @offset_value;
