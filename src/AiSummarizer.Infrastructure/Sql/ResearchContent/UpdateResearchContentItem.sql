update research_content_items
set
    research_content_run_id = @research_content_run_id,
    research_topic_run_id = @research_topic_run_id,
    research_topic_id = @research_topic_id,
    source_key = @source_key,
    source_url = @source_url,
    canonical_url = @canonical_url,
    title = @title,
    author_name = @author_name,
    published_at = @published_at,
    fetch_method = @fetch_method,
    content_type = @content_type,
    status = @status,
    content_hash = @content_hash,
    raw_text = @raw_text,
    raw_storage_path = @raw_storage_path,
    raw_metadata_json = @raw_metadata_json,
    error_code = @error_code,
    error_message = @error_message,
    updated_at = @updated_at
where id = @id;
