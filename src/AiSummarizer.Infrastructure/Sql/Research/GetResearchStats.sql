with filtered_topics as (
    select id, status
    from research_topics
    where (@requested_by_user_id::uuid is null or requested_by_user_id = @requested_by_user_id)
)
select
    count(*) filter (where status = 'active')::int as active_topics,
    coalesce((
        select count(*)::int
        from research_briefings b
        join filtered_topics t on t.id = b.research_topic_id
    ), 0) as briefings_generated,
    coalesce((
        select count(*)::int
        from research_topic_sources s
        join filtered_topics t on t.id = s.research_topic_id
    ), 0) as sources_tracked,
    coalesce((
        select round(avg(b.read_time_minutes))::int
        from research_briefings b
        join filtered_topics t on t.id = b.research_topic_id
    ), 0) as avg_read_time_minutes
from filtered_topics;
