delete from research_topic_outputs
where research_topic_id = @topic_id;

insert into research_topic_outputs (research_topic_id, output_key, sort_order)
select
    @topic_id,
    value,
    ordinality - 1
from unnest(@outputs::text[]) with ordinality as t(value, ordinality);
