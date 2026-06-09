select exists (
    select 1
    from research_topic_runs
    where research_topic_id = @topic_id
      and status in ('queued', 'running')
    union all
    select 1
    from jobs
    where job_type = 'research.topic.run'
      and status in ('queued', 'retry_wait', 'running')
      and payload_json->>'researchTopicId' = @topic_id::text
) as has_active_run;
