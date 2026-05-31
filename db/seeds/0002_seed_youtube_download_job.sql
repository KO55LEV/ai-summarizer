-- Edit these values before running.
insert into jobs (
    id,
    requested_by_user_id,
    job_type,
    priority,
    status,
    payload_json,
    max_attempts,
    available_at
)
values (
    gen_random_uuid(),
    '617a8af2-bae2-43a6-938f-7c384e3061ee',
    'youtube.download',
    0,
    'queued',
    jsonb_build_object(
        'youtubeUrl', 'https://www.youtube.com/watch?v=lJ-qZc0toN0',
        'customFileName', null,
        'outputDirectory', '/Volumes/Data/AiSummary/YouTube'
    ),
    3,
    now()
)
returning id, requested_by_user_id, payload_json;