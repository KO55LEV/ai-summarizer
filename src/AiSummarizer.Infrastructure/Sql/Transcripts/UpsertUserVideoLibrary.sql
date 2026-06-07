insert into user_video_library (
    id,
    requested_by_user_id,
    media_source_id,
    public_request_run_id,
    workflow_id,
    transcript_id,
    status,
    source_url,
    completed_at,
    created_at,
    updated_at
)
values (
    @id,
    @requested_by_user_id,
    @media_source_id,
    @public_request_run_id,
    @workflow_id,
    @transcript_id,
    @status,
    @source_url,
    @completed_at,
    @created_at,
    @updated_at
)
on conflict (requested_by_user_id, media_source_id)
do update set
    public_request_run_id = excluded.public_request_run_id,
    workflow_id = excluded.workflow_id,
    transcript_id = excluded.transcript_id,
    status = excluded.status,
    source_url = excluded.source_url,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at
returning id, requested_by_user_id, media_source_id, public_request_run_id, workflow_id, transcript_id, status, source_url, completed_at, created_at, updated_at;
