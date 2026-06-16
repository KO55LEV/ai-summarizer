select id, job_id, workflow_id, status, created_at
from (
    select
        id,
        job_id,
        workflow_id,
        status,
        created_at
    from research_topic_runs
    where research_topic_id = @topic_id
      and status in ('queued', 'running')

    union all

    select
        id,
        id as job_id,
        nullif(payload_json->>'workflowId', '')::uuid as workflow_id,
        case when status = 'retry_wait' then 'queued' else status end as status,
        created_at
    from jobs
    where job_type = 'research.topic.run'
      and status in ('queued', 'retry_wait', 'running')
      and payload_json->>'researchTopicId' = @topic_id::text
      and not exists (
          select 1
          from research_topic_runs r
          where r.job_id = jobs.id
      )
) active_runs
order by created_at desc
limit 1;
