create index if not exists ix_workflows_youtube_url_active
    on workflows ((input_json ->> 'youtubeUrl'))
    where status in ('queued', 'running', 'waiting');
