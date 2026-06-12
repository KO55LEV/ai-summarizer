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
        'b1d7a6f0-7fd1-4d4d-9f31-7ef1d3b7d101'::uuid,
        'youtube.summary.quick_summary',
        'YouTube quick summary',
        'Generates a concise overview of a video transcript for the Quick Summary action.',
        'youtube.summary.quick_summary',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You are a video summary engine.
Produce only valid JSON matching this schema:
{
  "summary": "string",
  "oneSentence": "string",
  "bullets": ["string"],
  "confidence": "low|medium|high"
}
Write a concise, grounded summary based only on the provided transcript.
Do not add markdown, commentary, or any text outside the JSON body.$$,
        $${
  "video": {
    "title": "{{video_title}}",
    "channel": "{{channel_name}}",
    "language": "{{language}}"
  },
  "transcript": "{{transcript}}"
}$$,
        true,
        now(),
        now()
    ),
    (
        '5f3b0d9d-4f1f-42f9-9b57-bf41c8a8d202'::uuid,
        'youtube.summary.key_takeaways',
        'YouTube key takeaways',
        'Extracts the most important points from a transcript for the Key Takeaways action.',
        'youtube.summary.key_takeaways',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You are a key takeaways extractor.
Produce only valid JSON matching this schema:
{
  "summary": "string",
  "takeaways": [
    {
      "point": "string",
      "evidence": "string",
      "importance": "low|medium|high"
    }
  ]
}
Return 5 to 8 distinct takeaways.
Favor concrete, useful, and non-overlapping insights.
Use only the transcript as evidence.
Do not add markdown or explanation outside the JSON body.$$,
        $${
  "video": {
    "title": "{{video_title}}",
    "channel": "{{channel_name}}",
    "language": "{{language}}"
  },
  "transcript": "{{transcript}}"
}$$,
        true,
        now(),
        now()
    ),
    (
        '7e65f3ec-5db1-4b62-85fa-8f2f09d3a303'::uuid,
        'youtube.summary.ask_this_video',
        'YouTube ask this video',
        'Answers questions about a video transcript with supporting evidence for the Ask this video action.',
        'youtube.summary.ask_this_video',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You answer questions about a single video using only the supplied transcript excerpt and brief conversation context.
Produce only valid JSON matching this schema:
{
  "answer": "string",
  "supportingEvidence": [
    {
      "quote": "string",
      "timestamp": "string"
    }
  ],
  "confidence": "low|medium|high",
  "followUpQuestions": ["string"],
  "limitations": ["string"]
}
If the transcript excerpt does not support the answer, say so clearly instead of guessing.
Keep the answer concise: 2 to 4 short sentences maximum.
Return at most 3 evidence items, 2 follow-up questions, and 2 limitations.
Use a direct, conversational tone inside the JSON values, but do not add markdown or prose outside the JSON body.$$,
        $${
  "video": {
    "title": "{{video_title}}",
    "channel": "{{channel_name}}",
    "language": "{{language}}"
  },
  "question": "{{question}}",
  "conversationContext": "{{conversation_context}}",
  "transcriptExcerpt": "{{transcript_excerpt}}"
}$$,
        true,
        now(),
        now()
    ),
    (
        'a9a4c635-2bc2-4d53-9e13-7c0b57d4b404'::uuid,
        'youtube.summary.study_guide',
        'YouTube study guide',
        'Creates flashcards, a short quiz, and revision notes from a transcript for the Study Guide action.',
        'youtube.summary.study_guide',
        'openrouter',
        'openai/gpt-4.1-mini',
        $$You are a study-guide generator for a video transcript.
Produce only valid JSON matching this schema:
{
  "overview": "string",
  "keyTerms": [
    {
      "term": "string",
      "definition": "string"
    }
  ],
  "flashcards": [
    {
      "front": "string",
      "back": "string"
    }
  ],
  "quiz": [
    {
      "question": "string",
      "choices": ["string"],
      "answerIndex": 0,
      "explanation": "string"
    }
  ]
}
Keep the output concise, accurate, and grounded in the transcript.
Prefer practical study material over generic summary text.
Do not add markdown or any text outside the JSON body.$$,
        $${
  "video": {
    "title": "{{video_title}}",
    "channel": "{{channel_name}}",
    "language": "{{language}}"
  },
  "transcript": "{{transcript}}"
}$$,
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
