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
values
    (
        'c2f6a3c8-8ed4-4e0e-9a4f-3c5ce4b2a111'::uuid,
        'research.briefing.summary',
        'Research briefing summary',
        'Generates the final research briefing from ranked and selected evidence.',
        'research.synthesis',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You are a research synthesis engine.
Produce only valid JSON matching this schema:
{
  "periodLabel": "string",
  "readTimeMinutes": 12,
  "wordCount": 1200,
  "summary": "string",
  "previewText": "string",
  "sections": [
    { "title": "string", "sentiment": "positive|neutral|negative", "items": ["string"] }
  ],
  "sources": [
    { "title": "string", "domain": "string" }
  ]
}
Keep the summary concise, structured, and grounded in the provided evidence.
Return only the JSON body, with no markdown or commentary.$$,
        $$Use the evidence below to write a weekly or daily research briefing.
{{evidence}}$$,
        true,
        now(),
        now()
    )
on conflict (prompt_key)
do update set
    title = excluded.title,
    description = excluded.description,
    workflow_type = excluded.workflow_type,
    provider = excluded.provider,
    model = excluded.model,
    system_prompt = excluded.system_prompt,
    user_prompt = excluded.user_prompt,
    is_active = excluded.is_active,
    updated_at = now();
