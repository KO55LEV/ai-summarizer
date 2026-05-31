insert into prompts (
    id,
    prompt_key,
    title,
    description,
    workflow_type,
    provider,
    model,
    system_prompt,
    user_prompt,
    is_active,
    created_at,
    updated_at
)
values (
    @id,
    @prompt_key,
    @title,
    @description,
    @workflow_type,
    @provider,
    @model,
    @system_prompt,
    @user_prompt,
    @is_active,
    @created_at,
    @updated_at
)
returning id, prompt_key, title, description, workflow_type, provider, model, system_prompt, user_prompt, is_active, created_at, updated_at;
