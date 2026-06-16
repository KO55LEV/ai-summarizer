select
    id,
    research_topic_id,
    plan_version,
    prompt_key,
    prompt_version,
    provider,
    model,
    status,
    plan_json::text as plan_json,
    input_hash,
    source_hash,
    generated_at,
    error_code,
    error_message,
    created_at,
    updated_at
from research_topic_search_plans
where research_topic_id = @topic_id
limit 1;
