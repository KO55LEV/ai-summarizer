create table if not exists research_documents (
    id uuid primary key default gen_random_uuid(),
    research_content_item_id uuid not null references research_content_items(id) on delete cascade,
    research_topic_run_id uuid not null references research_topic_runs(id) on delete cascade,
    research_topic_id uuid not null references research_topics(id) on delete cascade,
    source_key text not null,
    canonical_url text not null,
    title text not null,
    author_name text null,
    published_at timestamptz null,
    normalized_at timestamptz not null default now(),
    canonical_body text not null,
    canonical_hash text not null,
    raw_content_hash text not null,
    source_provenance_json jsonb not null default '{}'::jsonb,
    normalizer_version text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_research_documents_topic_run
    on research_documents (research_topic_run_id, created_at desc);

create index if not exists ix_research_documents_content_item
    on research_documents (research_content_item_id);

create index if not exists ix_research_documents_canonical_hash
    on research_documents (canonical_hash);

drop trigger if exists trg_research_documents_updated_at on research_documents;
create trigger trg_research_documents_updated_at
before update on research_documents
for each row
execute function set_updated_at();

create table if not exists research_document_chunks (
    id uuid primary key default gen_random_uuid(),
    research_document_id uuid not null references research_documents(id) on delete cascade,
    chunk_index integer not null,
    chunk_title text null,
    chunk_text text not null,
    token_count integer not null,
    start_offset integer not null,
    end_offset integer not null,
    chunk_hash text not null,
    chunk_metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_research_document_chunks unique (research_document_id, chunk_index),
    constraint ck_research_document_chunks_offsets check (start_offset >= 0 and end_offset >= start_offset),
    constraint ck_research_document_chunks_token_count check (token_count >= 0)
);

create index if not exists ix_research_document_chunks_document
    on research_document_chunks (research_document_id, chunk_index asc);

drop trigger if exists trg_research_document_chunks_updated_at on research_document_chunks;
create trigger trg_research_document_chunks_updated_at
before update on research_document_chunks
for each row
execute function set_updated_at();
