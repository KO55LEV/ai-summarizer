select count(*)::int as briefing_count
from research_briefings
where research_topic_id = @topic_id;
