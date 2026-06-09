update research_topics
set
    next_run_at = @next_run_at,
    updated_at = @updated_at
where id = @topic_id;
