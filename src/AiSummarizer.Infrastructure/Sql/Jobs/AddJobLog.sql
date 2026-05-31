insert into job_logs (job_id, attempt_no, level, message, context_json)
values (@job_id, @attempt_no, @level, @message, @context_json)
returning id, job_id, attempt_no, level, message, context_json, created_at;
