update user_video_library
set transcript_id = @transcript_id,
    status = 'completed',
    completed_at = @completed_at,
    updated_at = @completed_at
where media_source_id = @media_source_id;
