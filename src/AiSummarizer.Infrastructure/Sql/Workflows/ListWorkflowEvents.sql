select id, workflow_id, step_key, level, message, context_json, created_at
from workflow_events
where workflow_id = @workflow_id
order by created_at desc
limit @limit_value offset @offset_value;
