select
    id,
    generated_at,
    preview_text
from research_briefings
where research_topic_id = @topic_id
order by generated_at desc
limit @limit_value offset @offset_value;
