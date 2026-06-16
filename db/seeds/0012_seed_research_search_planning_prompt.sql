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
        '7f8a8bca-9a31-47ad-b7ad-5e55f5d0e9c1'::uuid,
        'research.search.plan',
        'Research search planning',
        'Turns topic title and intent into compact source-specific search directives.',
        'research.planning',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You are a research search planner.
Produce only valid JSON and nothing else.
Your job is to convert a research topic into short, source-specific search directives.
Do not write explanations, markdown, or prose outside JSON.

Return JSON with this shape:
{
  "topicSummary": "string",
  "language": "string or null",
  "keywords": ["string"],
  "entities": ["string"],
  "negativeTerms": ["string"],
  "sourcePlans": [
    {
      "source": "web|news|archive|reddit|financial|twitter|youtube",
      "queries": ["string"],
      "recency": "hour|day|week|month|null",
      "excludeTerms": ["string"],
      "maxResults": 10
    }
  ]
}

Rules:
- Keep queries short, usually 2 to 6 words.
- Remove duplicate wording from the title and intent.
- Prefer natural search phrases, not full sentences.
- For YouTube, prefer video-discovery terms, creator names, channel names, titles, or topics.
- For news, prefer recent event wording.
- For Reddit, prefer discussion-oriented wording.
- For financial, prefer company/ticker/event wording.
- If the topic language is obvious, set language accordingly; otherwise null.
- If a source is not useful, omit it from sourcePlans.
- Keep maxResults between 3 and 10.
- Return only JSON.$$,
        $$Topic title: {{title}}

Topic intent: {{intent}}

Selected sources: {{sources}}

Topic tags: {{tags}}

Frequency: {{frequency}}

Generate the shortest useful search plan.$$,
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
