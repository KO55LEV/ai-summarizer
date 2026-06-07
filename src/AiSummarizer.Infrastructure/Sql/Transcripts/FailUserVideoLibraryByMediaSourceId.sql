update user_video_library
set status = 'failed',
    completed_at = @failed_at,
    updated_at = @failed_at
where media_source_id = @media_source_id
  and status <> 'completed';
