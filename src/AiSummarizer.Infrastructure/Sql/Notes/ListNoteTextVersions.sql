select id, note_id, source_run_id, version_kind, text, language, provider, model, prompt_version, created_at
from note_text_versions
where note_id = @note_id
order by created_at asc;
