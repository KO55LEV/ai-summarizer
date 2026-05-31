select id, prompt_id, archive_version, archive_reason, prompt_key, title, description, workflow_type, provider, model, system_prompt, user_prompt, is_active, archived_at, source_updated_at
from prompt_archive
where prompt_id = @prompt_id
order by archive_version desc
limit @limit_value offset @offset_value;
