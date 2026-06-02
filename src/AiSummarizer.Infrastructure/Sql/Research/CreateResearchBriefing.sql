insert into research_briefings (
    id,
    research_topic_id,
    requested_by_user_id,
    briefing_version,
    generated_at,
    period_label,
    read_time_minutes,
    word_count,
    summary,
    preview_text,
    created_at,
    updated_at
)
values (
    @id,
    @research_topic_id,
    @requested_by_user_id,
    @briefing_version,
    @generated_at,
    @period_label,
    @read_time_minutes,
    @word_count,
    @summary,
    @preview_text,
    @created_at,
    @updated_at
)
returning id;
