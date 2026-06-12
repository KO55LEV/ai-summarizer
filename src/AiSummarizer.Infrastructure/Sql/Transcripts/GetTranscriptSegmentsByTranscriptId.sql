select id, transcript_id, segment_index, start_seconds, end_seconds, text_offset_start, text_offset_end, text, speaker_label, word_count, character_count, metadata_json, created_at
from transcript_segments
where transcript_id = @transcript_id
order by segment_index asc;
