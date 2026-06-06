select id, requested_by_user_id, project_id, title, status, source_channel, input_kind, primary_language, current_text_version_id, summary, created_at, updated_at
from notes
where id = @note_id;
