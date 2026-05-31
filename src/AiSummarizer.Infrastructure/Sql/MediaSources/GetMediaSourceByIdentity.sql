select id, source_provider, source_kind, external_source_id, canonical_url, original_url, duration_seconds, native_transcript_available, native_transcript_checked_at, native_transcript_language, metadata_json, created_at, updated_at
from media_sources
where source_provider = @source_provider
  and source_kind = @source_kind
  and external_source_id = @external_source_id
limit 1;
