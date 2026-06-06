insert into note_assets (
    id,
    note_id,
    note_input_id,
    asset_type,
    mime_type,
    storage_key,
    original_filename,
    size_bytes,
    checksum_sha256,
    duration_seconds,
    width,
    height,
    metadata_json,
    created_at,
    updated_at
)
values (
    @id,
    @note_id,
    @note_input_id,
    @asset_type,
    @mime_type,
    @storage_key,
    @original_filename,
    @size_bytes,
    @checksum_sha256,
    @duration_seconds,
    @width,
    @height,
    @metadata_json,
    now(),
    now()
)
returning id, note_id, note_input_id, asset_type, mime_type, storage_key, original_filename, size_bytes, checksum_sha256, duration_seconds, width, height, metadata_json::text as metadata_json, created_at, updated_at;
