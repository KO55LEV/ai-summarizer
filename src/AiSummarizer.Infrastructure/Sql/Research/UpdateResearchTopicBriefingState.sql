update research_topics
set
    last_run_at = @last_run_at,
    next_run_at = @next_run_at,
    last_briefing_preview = @last_briefing_preview,
    updated_at = @updated_at
where id = @topic_id;
