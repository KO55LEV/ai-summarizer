alter table research_topics
    add column if not exists lookback_window text null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_research_topics_lookback_window'
    ) then
        alter table research_topics
            add constraint ck_research_topics_lookback_window
            check (lookback_window in ('hour', 'day', 'week', 'month'));
    end if;
end $$;
