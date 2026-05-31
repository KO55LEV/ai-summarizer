select id, workflow_id, step_order, step_key, step_type, job_id, status, input_json, output_json, error_code, error_message, started_at, finished_at, created_at, updated_at
from workflow_steps
where workflow_id = @workflow_id
order by step_order asc, created_at asc;
