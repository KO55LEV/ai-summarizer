insert into media_sources (
    id,
    source_provider,
    source_kind,
    external_source_id,
    canonical_url,
    original_url,
    duration_seconds,
    native_transcript_available,
    native_transcript_checked_at,
    native_transcript_language,
    metadata_json,
    created_at,
    updated_at
)
values (
    @id,
    @source_provider,
    @source_kind,
    @external_source_id,
    @canonical_url,
    @original_url,
    @duration_seconds,
    @native_transcript_available,
    @native_transcript_checked_at,
    @native_transcript_language,
    @metadata_json,
    @created_at,
    @updated_at
)
on conflict (source_provider, source_kind, external_source_id) do update set
    canonical_url = excluded.canonical_url,
    original_url = excluded.original_url,
    duration_seconds = coalesce(excluded.duration_seconds, media_sources.duration_seconds),
    native_transcript_available = coalesce(excluded.native_transcript_available, media_sources.native_transcript_available),
    native_transcript_checked_at = coalesce(excluded.native_transcript_checked_at, media_sources.native_transcript_checked_at),
    native_transcript_language = coalesce(excluded.native_transcript_language, media_sources.native_transcript_language),
    metadata_json = coalesce(media_sources.metadata_json, '{}'::jsonb) || coalesce(excluded.metadata_json, '{}'::jsonb),
    updated_at = excluded.updated_at
returning id, source_provider, source_kind, external_source_id, canonical_url, original_url, duration_seconds, native_transcript_available, native_transcript_checked_at, native_transcript_language, metadata_json, created_at, updated_at;
