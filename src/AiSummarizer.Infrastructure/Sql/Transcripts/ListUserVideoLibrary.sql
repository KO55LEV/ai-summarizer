select
    u.id,
    u.requested_by_user_id,
    u.media_source_id,
    u.public_request_run_id,
    u.workflow_id,
    u.transcript_id,
    u.status,
    m.source_provider,
    m.source_kind,
    m.external_source_id,
    u.source_url,
    t.language,
    t.duration_seconds,
    u.completed_at,
    u.created_at,
    u.updated_at
from user_video_library u
join media_sources m on m.id = u.media_source_id
left join transcripts t on t.id = u.transcript_id
where u.requested_by_user_id = @requested_by_user_id
  and (@status is null or u.status = @status)
order by u.updated_at desc
limit @limit_value offset @offset_value;
