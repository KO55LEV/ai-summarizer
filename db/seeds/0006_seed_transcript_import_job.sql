insert into jobs (
    id,
    parent_job_id,
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
    'a02a7e94-1320-41c3-8dda-2058fc1617ee',
    '617a8af2-bae2-43a6-938f-7c384e3061ee',
    'transcript.import',
    0,
    'queued',
    jsonb_build_object(
        'transcriptFilePath', '/Volumes/Data/AiSummary/Transcripts/a02a7e94132041c38dda2058fc1617ee/Маргулан Сейсембай про ИИ, инвестиции и личный бренд | Как не проиграть в 2026 году?.json',
        'sourceFilePath', '/Volumes/Data/AiSummary/Audio/5a61c985573c4b82a813e957d434f61b/Маргулан Сейсембай про ИИ, инвестиции и личный бренд | Как не проиграть в 2026 году?.m4a',
        'sourceJobId', 'a02a7e94-1320-41c3-8dda-2058fc1617ee'
    ),
    3,
    now()
);
