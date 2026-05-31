select id, job_id, source_id, source_job_id, source_url, source_file_path, transcript_file_path, language, language_probability, duration_seconds, segment_count, word_count, character_count, transcript_text, metadata_json, created_at, updated_at
from transcripts
where source_url = @source_url
order by created_at desc
limit 1;
