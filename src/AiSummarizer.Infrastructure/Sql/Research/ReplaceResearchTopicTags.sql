delete from research_topic_tags
where research_topic_id = @topic_id;

insert into research_topic_tags (research_topic_id, tag, sort_order)
select
    @topic_id,
    value,
    ordinality - 1
from unnest(@tags::text[]) with ordinality as t(value, ordinality);
