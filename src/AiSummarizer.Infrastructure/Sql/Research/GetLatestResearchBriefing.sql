with base as (
    select b.*
    from research_briefings b
    where b.research_topic_id = @topic_id
    order by b.generated_at desc
    limit 1
)
select
    b.id,
    b.research_topic_id,
    t.requested_by_user_id,
    t.name as topic_name,
    b.generated_at,
    b.period_label,
    b.read_time_minutes,
    b.word_count,
    b.summary,
    b.preview_text,
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'title', s.title,
                'sentiment', s.sentiment,
                'items', s.items_jsonb
            )
            order by s.section_order asc
        )
        from research_briefing_sections s
        where s.research_briefing_id = b.id
    ), '[]'::jsonb) as sections_json,
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'title', s.title,
                'domain', s.domain
            )
            order by s.source_order asc
        )
        from research_briefing_sources s
        where s.research_briefing_id = b.id
    ), '[]'::jsonb) as sources_json,
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', other.id,
                'generated_at', other.generated_at,
                'preview_text', other.preview_text
            )
            order by other.generated_at desc
        )
        from (
            select other.id, other.generated_at, other.preview_text
            from research_briefings other
            where other.research_topic_id = b.research_topic_id
              and other.id <> b.id
            order by other.generated_at desc
            limit 10
        ) other
    ), '[]'::jsonb) as past_briefings_json
from base b
join research_topics t on t.id = b.research_topic_id;
