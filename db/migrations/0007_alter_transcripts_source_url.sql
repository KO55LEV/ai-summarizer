alter table transcripts
    add column if not exists source_url text null;

alter table transcripts
    alter column source_file_path drop not null;

create index if not exists ix_transcripts_source_url
    on transcripts (source_url, created_at desc);
