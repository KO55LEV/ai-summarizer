select id, research_topic_id, requested_by_user_id, job_id, workflow_id, status, triggered_by, started_at, finished_at, next_retry_at, error_code, error_message, summary_preview, created_at, updated_at
from research_topic_runs
where id = @run_id;
