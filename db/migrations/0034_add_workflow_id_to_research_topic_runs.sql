alter table if exists research_topic_runs
    add column if not exists workflow_id uuid null references workflows(id) on delete set null;

create index if not exists ix_research_topic_runs_workflow
    on research_topic_runs (workflow_id);
