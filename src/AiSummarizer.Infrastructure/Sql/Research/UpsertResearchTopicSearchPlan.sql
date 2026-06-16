insert into research_topic_search_plans (
    id,
    research_topic_id,
    plan_version,
    prompt_key,
    prompt_version,
    provider,
    model,
    status,
    plan_json,
    input_hash,
    source_hash,
    generated_at,
    error_code,
    error_message,
    created_at,
    updated_at
)
values (
    @id,
    @research_topic_id,
    @plan_version,
    @prompt_key,
    @prompt_version,
    @provider,
    @model,
    @status,
    @plan_json,
    @input_hash,
    @source_hash,
    @generated_at,
    @error_code,
    @error_message,
    @created_at,
    @updated_at
)
on conflict (research_topic_id)
do update set
    plan_version = excluded.plan_version,
    prompt_key = excluded.prompt_key,
    prompt_version = excluded.prompt_version,
    provider = excluded.provider,
    model = excluded.model,
    status = excluded.status,
    plan_json = excluded.plan_json,
    input_hash = excluded.input_hash,
    source_hash = excluded.source_hash,
    generated_at = excluded.generated_at,
    error_code = excluded.error_code,
    error_message = excluded.error_message,
    updated_at = excluded.updated_at
returning id;
