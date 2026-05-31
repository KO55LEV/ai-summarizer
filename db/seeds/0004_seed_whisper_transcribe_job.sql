-- Edit these values before running.
insert into jobs (
    id,
    requested_by_user_id,
    parent_job_id,
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
    '5a61c985-573c-4b82-a813-e957d434f61b',
    'whisper.transcribe',
    0,
    'queued',
    jsonb_build_object(
        'sourceJobId', '5a61c985-573c-4b82-a813-e957d434f61b',
        'sourceFilePath', '/Volumes/Data/AiSummary/Audio/5a61c985573c4b82a813e957d434f61b/Маргулан Сейсембай про ИИ, инвестиции и личный бренд | Как не проиграть в 2026 году?.m4a',
        'outputDirectory', '/Volumes/Data/AiSummary/Transcripts',
        'language', 'ru'
    ),
    3,
    now()
)
returning id, requested_by_user_id, parent_job_id, payload_json;
