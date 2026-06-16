select
    t.id,
    t.requested_by_user_id,
    t.project_id,
    t.name,
    t.description,
    t.frequency,
    t.lookback_window,
    t.status,
    t.delivery_time,
    t.last_run_at,
    t.next_run_at,
    t.last_briefing_preview,
    t.created_at,
    t.updated_at,
    coalesce(s.sources, '{}'::text[]) as sources,
    coalesce(g.tags, '{}'::text[]) as tags,
    coalesce(o.outputs, '{}'::text[]) as outputs,
    coalesce(b.briefings_count, 0) as briefings_count
from research_topics t
left join lateral (
    select array_agg(source_key order by sort_order asc) as sources
    from research_topic_sources
    where research_topic_id = t.id
) s on true
left join lateral (
    select array_agg(tag order by sort_order asc) as tags
    from research_topic_tags
    where research_topic_id = t.id
) g on true
left join lateral (
    select array_agg(output_key order by sort_order asc) as outputs
    from research_topic_outputs
    where research_topic_id = t.id
) o on true
left join lateral (
    select count(*)::int as briefings_count
    from research_briefings
    where research_topic_id = t.id
) b on true
where (@requested_by_user_id::uuid is null or t.requested_by_user_id = @requested_by_user_id)
order by t.created_at desc
limit @limit_value offset @offset_value;
