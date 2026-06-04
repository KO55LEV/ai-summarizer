with test_user as (
    select id
    from users
    where lower(email) = lower('test@test.com')
      and deleted_at is null
      limit 1
),
demo_user as (
    select id
    from users
    where id = '617a8af2-bae2-43a6-938f-7c384e3061ee'::uuid
    limit 1
),
topic_rows as (
    insert into research_topics (
        id,
        requested_by_user_id,
        name,
        description,
        frequency,
        status,
        delivery_time,
        last_run_at,
        next_run_at,
        last_briefing_preview,
        created_at,
        updated_at
    )
    select *
    from (
        values
            (
                '11111111-1111-1111-1111-111111111111'::uuid,
                coalesce((select id from demo_user), (select id from test_user)),
                'AI & Machine Learning Weekly',
                'Daily digest of the latest AI research papers, product launches, and industry news from arXiv, TechCrunch, and major AI lab blogs.',
                'daily',
                'active',
                '08:00'::time,
                now() - interval '2 hour',
                now() + interval '22 hour',
                'OpenAI previewed GPT-5 Turbo with 10× reasoning improvements. Google DeepMind published a breakthrough paper on autonomous agents. EU AI Act implementation guidelines finalised.',
                now() - interval '7 day',
                now() - interval '2 hour'
            ),
            (
                '22222222-2222-2222-2222-222222222222'::uuid,
                coalesce((select id from demo_user), (select id from test_user)),
                'Global Stock Market Digest',
                'Daily summary of major market movements, earnings releases, macroeconomic events, and analyst commentary across global equities.',
                'daily',
                'active',
                '07:30'::time,
                now() - interval '5 hour',
                now() + interval '19 hour',
                'S&P 500 closed +0.82% led by tech. Fed minutes hint at rate hold through Q3. Nvidia Q1 earnings beat expectations with $36.4B revenue.',
                now() - interval '5 day',
                now() - interval '5 hour'
            )
    ) as v(
        id, requested_by_user_id, name, description, frequency, status, delivery_time, last_run_at, next_run_at, last_briefing_preview, created_at, updated_at
    )
    on conflict (id)
    do update set
        requested_by_user_id = excluded.requested_by_user_id,
        name = excluded.name,
        description = excluded.description,
        frequency = excluded.frequency,
        status = excluded.status,
        delivery_time = excluded.delivery_time,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at,
        last_briefing_preview = excluded.last_briefing_preview,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    returning id
),
_sources as (
    insert into research_topic_sources (research_topic_id, source_key, sort_order)
    values
        ('11111111-1111-1111-1111-111111111111', 'web', 0),
        ('11111111-1111-1111-1111-111111111111', 'news', 1),
        ('11111111-1111-1111-1111-111111111111', 'youtube', 2),
        ('22222222-2222-2222-2222-222222222222', 'web', 0),
        ('22222222-2222-2222-2222-222222222222', 'news', 1),
        ('22222222-2222-2222-2222-222222222222', 'financial', 2)
    on conflict do nothing
    returning 1
),
_tags as (
    insert into research_topic_tags (research_topic_id, tag, sort_order)
    values
        ('11111111-1111-1111-1111-111111111111', 'AI', 0),
        ('11111111-1111-1111-1111-111111111111', 'LLM', 1),
        ('11111111-1111-1111-1111-111111111111', 'machine learning', 2),
        ('22222222-2222-2222-2222-222222222222', 'stocks', 0),
        ('22222222-2222-2222-2222-222222222222', 'markets', 1),
        ('22222222-2222-2222-2222-222222222222', 'finance', 2)
    on conflict do nothing
    returning 1
),
_outputs as (
    insert into research_topic_outputs (research_topic_id, output_key, sort_order)
    values
        ('11111111-1111-1111-1111-111111111111', 'briefing', 0),
        ('11111111-1111-1111-1111-111111111111', 'structured', 1),
        ('11111111-1111-1111-1111-111111111111', 'voice', 2),
        ('22222222-2222-2222-2222-222222222222', 'briefing', 0),
        ('22222222-2222-2222-2222-222222222222', 'structured', 1)
    on conflict do nothing
    returning 1
),
briefings as (
    insert into research_briefings (
        id,
        research_topic_id,
        requested_by_user_id,
        briefing_version,
        generated_at,
        period_label,
        read_time_minutes,
        word_count,
        summary,
        preview_text,
        created_at,
        updated_at
    )
    select *
    from (
        values
            (
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                '11111111-1111-1111-1111-111111111111'::uuid,
                coalesce((select id from demo_user), (select id from test_user)),
                4,
                timestamptz '2026-06-01 08:00:00+00',
                'May 31 – June 1, 2026',
                4,
                847,
                'A landmark 24 hours in artificial intelligence: OpenAI previewed its next-generation reasoning model, Google DeepMind published breakthrough research on autonomous agents, and the EU finalised implementation guidelines for the AI Act affecting enterprise deployments across all 27 member states.',
                'OpenAI previewed GPT-5 Turbo with 10× reasoning improvements. Google DeepMind published a breakthrough paper on autonomous agents. EU AI Act implementation guidelines finalised.',
                timestamptz '2026-06-01 08:00:00+00',
                timestamptz '2026-06-01 08:00:00+00'
            ),
            (
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
                '11111111-1111-1111-1111-111111111111'::uuid,
                coalesce((select id from demo_user), (select id from test_user)),
                3,
                timestamptz '2026-05-31 08:00:00+00',
                'May 30 – May 31, 2026',
                4,
                742,
                'OpenAI reduced API pricing by 40% across all models while Anthropic published new safety research and Google I/O teased a larger Gemini model.',
                'OpenAI reduced API pricing by 40% across all models. Anthropic published Constitutional AI v2 safety research. Google I/O keynote teased Gemini 2.5 Ultra.',
                timestamptz '2026-05-31 08:00:00+00',
                timestamptz '2026-05-31 08:00:00+00'
            ),
            (
                'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
                '22222222-2222-2222-2222-222222222222'::uuid,
                coalesce((select id from demo_user), (select id from test_user)),
                1,
                timestamptz '2026-06-01 07:30:00+00',
                'May 31 – June 1, 2026',
                3,
                612,
                'US equities closed higher led by tech and energy sectors. Federal Reserve minutes reinforced a rate hold position. Strong non-farm payrolls data suggests continued economic resilience heading into Q3.',
                'S&P 500 closed +0.82% led by tech. Fed minutes hint at rate hold through Q3. Nvidia Q1 earnings beat expectations with $36.4B revenue.',
                timestamptz '2026-06-01 07:30:00+00',
                timestamptz '2026-06-01 07:30:00+00'
            )
    ) as v(
        id, research_topic_id, requested_by_user_id, briefing_version, generated_at, period_label, read_time_minutes, word_count, summary, preview_text, created_at, updated_at
    )
    on conflict (id)
    do update set
        research_topic_id = excluded.research_topic_id,
        requested_by_user_id = excluded.requested_by_user_id,
        briefing_version = excluded.briefing_version,
        generated_at = excluded.generated_at,
        period_label = excluded.period_label,
        read_time_minutes = excluded.read_time_minutes,
        word_count = excluded.word_count,
        summary = excluded.summary,
        preview_text = excluded.preview_text,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    returning id, research_topic_id, briefing_version
),
briefing_sections as (
    insert into research_briefing_sections (
        research_briefing_id,
        section_order,
        title,
        sentiment,
        items_jsonb
    )
    values
        (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            0,
            'Top Stories',
            'positive',
            '["OpenAI previewed GPT-5 Turbo with a 10× improvement on complex reasoning benchmarks.", "Google DeepMind''s Project Astra paper demonstrates real-time multimodal reasoning.", "Anthropic raised $3.5B Series F at a $61B valuation."]'::jsonb
        ),
        (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            1,
            'Research Papers',
            'neutral',
            '["Scaling Laws for Agent Memory outperformed base models by 34% on long-horizon tasks.", "MoE-Attention delivered a 2.4× inference speedup with 98.7% quality retention."]'::jsonb
        ),
        (
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            0,
            'Top Stories',
            'positive',
            '["OpenAI reduced API pricing by 40% across all models.", "Google I/O keynote teased Gemini 2.5 Ultra with a larger context window."]'::jsonb
        ),
        (
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            0,
            'Market Summary',
            'positive',
            '["S&P 500 closed +0.82% | Nasdaq +1.14% | Dow Jones +0.31%.", "10-year Treasury yield 4.41%, down 3bps on Fed hold expectations."]'::jsonb
        )
    on conflict do nothing
    returning 1
),
briefing_sources as (
    insert into research_briefing_sources (research_briefing_id, source_order, title, domain)
    values
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, 'OpenAI Blog', 'openai.com'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Google DeepMind Research', 'deepmind.google'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0, 'OpenAI Blog', 'openai.com'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Google I/O', 'blog.google'),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', 0, 'Bloomberg Markets', 'bloomberg.com'),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'Reuters Finance', 'reuters.com')
    on conflict do nothing
    returning 1
)
select count(*) from topic_rows;
