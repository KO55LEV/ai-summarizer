insert into note_text_versions (
    id,
    note_id,
    source_run_id,
    version_kind,
    text,
    language,
    provider,
    model,
    prompt_version,
    created_at
)
values (
    @id,
    @note_id,
    @source_run_id,
    @version_kind,
    @text,
    @language,
    @provider,
    @model,
    @prompt_version,
    now()
)
returning id, note_id, source_run_id, version_kind, text, language, provider, model, prompt_version, created_at;
