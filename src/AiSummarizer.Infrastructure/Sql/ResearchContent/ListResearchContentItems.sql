select id, research_content_run_id, research_topic_run_id, research_topic_id, source_key, source_url, canonical_url, title, author_name, published_at, fetch_method, content_type, status, content_hash, raw_text, raw_storage_path, raw_metadata_json, error_code, error_message, created_at, updated_at
from research_content_items
where research_topic_run_id = @research_topic_run_id
order by created_at asc
limit @limit_value offset @offset_value;
