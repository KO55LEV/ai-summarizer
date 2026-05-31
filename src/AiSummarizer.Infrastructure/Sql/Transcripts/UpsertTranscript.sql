insert into transcripts (
    id,
    job_id,
    source_job_id,
    source_file_path,
    transcript_file_path,
    language,
    language_probability,
    duration_seconds,
    segment_count,
    word_count,
    character_count,
    transcript_text,
    metadata_json
)
values (
    @id,
    @job_id,
    @source_job_id,
    @source_file_path,
    @transcript_file_path,
    @language,
    @language_probability,
    @duration_seconds,
    @segment_count,
    @word_count,
    @character_count,
    @transcript_text,
    @metadata_json
)
on conflict (job_id) do update set
    source_job_id = excluded.source_job_id,
    source_file_path = excluded.source_file_path,
    transcript_file_path = excluded.transcript_file_path,
    language = excluded.language,
    language_probability = excluded.language_probability,
    duration_seconds = excluded.duration_seconds,
    segment_count = excluded.segment_count,
    word_count = excluded.word_count,
    character_count = excluded.character_count,
    transcript_text = excluded.transcript_text,
    metadata_json = excluded.metadata_json
returning id, job_id, source_job_id, source_file_path, transcript_file_path, language, language_probability, duration_seconds, segment_count, word_count, character_count, transcript_text, metadata_json, created_at, updated_at;
