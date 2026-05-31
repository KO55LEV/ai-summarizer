insert into workflows (
    id,
    requested_by_user_id,
    workflow_type,
    status,
    input_json,
    max_attempts,
    available_at
)
values (
    gen_random_uuid(),
    '617a8af2-bae2-43a6-938f-7c384e3061ee',
    'youtube.summary',
    'queued',
    jsonb_build_object(
        'youtubeUrl', 'https://www.youtube.com/watch?v=lJ-qZc0toN0',
        'language', 'en',
        'preferNativeTranscript', true
    ),
    5,
    now()
);
