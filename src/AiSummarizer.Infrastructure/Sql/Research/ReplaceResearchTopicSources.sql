delete from research_topic_sources
where research_topic_id = @topic_id;

insert into research_topic_sources (research_topic_id, source_key, sort_order)
select
    @topic_id,
    value,
    ordinality - 1
from unnest(@sources::text[]) with ordinality as t(value, ordinality);
