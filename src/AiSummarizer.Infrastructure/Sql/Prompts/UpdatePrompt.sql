update prompts
set
    prompt_key = @prompt_key,
    title = @title,
    description = @description,
    workflow_type = @workflow_type,
    provider = @provider,
    model = @model,
    system_prompt = @system_prompt,
    user_prompt = @user_prompt,
    is_active = @is_active,
    updated_at = @updated_at
where id = @id
returning id, prompt_key, title, description, workflow_type, provider, model, system_prompt, user_prompt, is_active, created_at, updated_at;
