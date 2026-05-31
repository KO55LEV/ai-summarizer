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
    '26077d03-195d-4b30-b60a-12797926cdfb',
    'media.extract_audio',
    0,
    'queued',
    jsonb_build_object(
        'sourceJobId', '26077d03-195d-4b30-b60a-12797926cdfb',
        'sourceFilePath', (
            select result_json->>'outputFilePath'
            from jobs
            where id = '26077d03-195d-4b30-b60a-12797926cdfb'
        ),
        'customFileName', null,
        'outputDirectory', '/Volumes/Data/AiSummary/Audio',
        'audioFormat', 'm4a'
    ),
    3,
    now()
)
returning id, requested_by_user_id, parent_job_id, payload_json;
