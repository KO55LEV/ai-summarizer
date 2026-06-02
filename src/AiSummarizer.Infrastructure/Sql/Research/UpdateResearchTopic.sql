update research_topics
set
    requested_by_user_id = @requested_by_user_id,
    name = @name,
    description = @description,
    frequency = @frequency,
    status = @status,
    delivery_time = @delivery_time,
    last_run_at = @last_run_at,
    next_run_at = @next_run_at,
    last_briefing_preview = @last_briefing_preview,
    updated_at = @updated_at
where id = @id
returning id;
