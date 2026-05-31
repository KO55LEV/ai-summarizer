insert into transcript_segments (
    id,
    transcript_id,
    segment_index,
    start_seconds,
    end_seconds,
    text_offset_start,
    text_offset_end,
    text,
    speaker_label,
    word_count,
    character_count,
    metadata_json
)
values (
    @id,
    @transcript_id,
    @segment_index,
    @start_seconds,
    @end_seconds,
    @text_offset_start,
    @text_offset_end,
    @text,
    @speaker_label,
    @word_count,
    @character_count,
    @metadata_json
);
