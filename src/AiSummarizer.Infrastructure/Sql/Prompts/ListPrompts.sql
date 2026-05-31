select id, prompt_key, title, description, workflow_type, provider, model, system_prompt, user_prompt, is_active, created_at, updated_at
from prompts
order by created_at desc
limit @limit_value offset @offset_value;
