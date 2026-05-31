select id, job_id, attempt_no, level, message, context_json, created_at
from job_logs
where job_id = @job_id
order by created_at asc
limit @limit_value offset @offset_value;
