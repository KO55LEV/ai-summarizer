select
    j.id,
    @topic_id::uuid as research_topic_id,
    j.requested_by_user_id,
    j.id as job_id,
    nullif(j.payload_json->>'workflowId', '')::uuid as workflow_id,
    case when j.status = 'retry_wait' then 'queued' else j.status end as status,
    nullif(j.payload_json->>'triggeredBy', '') as triggered_by,
    j.started_at,
    j.finished_at,
    null::timestamptz as next_retry_at,
    j.error_code,
    j.error_message,
    j.progress_message as summary_preview,
    j.created_at,
    j.updated_at
from jobs j
where j.job_type = 'research.topic.run'
  and j.status in ('queued', 'retry_wait', 'running')
  and j.payload_json->>'researchTopicId' = @topic_id::text
  and not exists (
      select 1
      from research_topic_runs r
      where r.job_id = j.id
  )
order by j.created_at desc;
