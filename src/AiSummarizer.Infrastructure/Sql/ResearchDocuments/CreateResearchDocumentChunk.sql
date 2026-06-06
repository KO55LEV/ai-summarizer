insert into research_document_chunks (
    id,
    research_document_id,
    chunk_index,
    chunk_title,
    chunk_text,
    token_count,
    start_offset,
    end_offset,
    chunk_hash,
    chunk_metadata_json,
    created_at,
    updated_at
)
values (
    @id,
    @research_document_id,
    @chunk_index,
    @chunk_title,
    @chunk_text,
    @token_count,
    @start_offset,
    @end_offset,
    @chunk_hash,
    @chunk_metadata_json,
    @created_at,
    @updated_at
)
returning id;
