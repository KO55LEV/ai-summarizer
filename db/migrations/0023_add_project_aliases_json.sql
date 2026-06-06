alter table projects
    add column if not exists aliases_json jsonb not null default '[]'::jsonb;
