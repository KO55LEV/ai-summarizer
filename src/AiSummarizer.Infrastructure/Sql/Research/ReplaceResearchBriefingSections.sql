delete from research_briefing_sections
where research_briefing_id = @briefing_id;

insert into research_briefing_sections (
    research_briefing_id,
    section_order,
    title,
    sentiment,
    items_jsonb
)
select
    @briefing_id,
    (item->>'sectionOrder')::int,
    item->>'title',
    item->>'sentiment',
    coalesce(item->'items', '[]'::jsonb)
from jsonb_array_elements(@sections_json::jsonb) as item;
