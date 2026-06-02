insert into research_topics (
    id,
    requested_by_user_id,
    name,
    description,
    frequency,
    status,
    delivery_time,
    last_run_at,
    next_run_at,
    last_briefing_preview,
    created_at,
    updated_at
)
values (
    @id,
    @requested_by_user_id,
    @name,
    @description,
    @frequency,
    @status,
    @delivery_time,
    @last_run_at,
    @next_run_at,
    @last_briefing_preview,
    @created_at,
    @updated_at
)
returning id;
