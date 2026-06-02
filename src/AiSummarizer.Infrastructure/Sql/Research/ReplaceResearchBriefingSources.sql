delete from research_briefing_sources
where research_briefing_id = @briefing_id;

insert into research_briefing_sources (
    research_briefing_id,
    source_order,
    title,
    domain
)
select
    @briefing_id,
    (item->>'sourceOrder')::int,
    item->>'title',
    item->>'domain'
from jsonb_array_elements(@sources_json::jsonb) as item;
