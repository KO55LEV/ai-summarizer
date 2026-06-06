select id, research_content_item_id, research_topic_run_id, research_topic_id, source_key, canonical_url, title, author_name, published_at, normalized_at, canonical_body, canonical_hash, raw_content_hash, source_provenance_json, normalizer_version, created_at, updated_at
from research_documents
where research_topic_run_id = @research_topic_run_id
order by normalized_at asc
limit @limit_value offset @offset_value;
