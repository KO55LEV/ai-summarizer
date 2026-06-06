select id, research_document_id, chunk_index, chunk_title, chunk_text, token_count, start_offset, end_offset, chunk_hash, chunk_metadata_json, created_at, updated_at
from research_document_chunks
where research_document_id = @research_document_id
order by chunk_index asc;
