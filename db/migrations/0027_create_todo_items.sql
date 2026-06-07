create table if not exists todo_items (
    id uuid primary key default gen_random_uuid(),
    requested_by_user_id uuid null references users(id) on delete set null,
    project_id uuid null references projects(id) on delete set null,
    title text not null,
    description text null,
    cadence text not null default 'daily',
    status text not null default 'open',
    priority text not null default 'medium',
    due_at timestamptz null,
    completed_at timestamptz null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_todo_items_title check (length(trim(title)) > 0),
    constraint ck_todo_items_cadence check (cadence in ('daily', 'weekly', 'monthly', 'yearly', 'target')),
    constraint ck_todo_items_status check (status in ('open', 'doing', 'blocked', 'done', 'archived')),
    constraint ck_todo_items_priority check (priority in ('low', 'medium', 'high', 'urgent'))
);

create index if not exists ix_todo_items_requested_by_created_at
    on todo_items (requested_by_user_id, created_at desc);

create index if not exists ix_todo_items_requested_by_status_created_at
    on todo_items (requested_by_user_id, status, created_at desc);

create index if not exists ix_todo_items_requested_by_due_at
    on todo_items (requested_by_user_id, due_at asc);

create index if not exists ix_todo_items_project_created_at
    on todo_items (project_id, created_at desc);

create index if not exists ix_todo_items_cadence_status_created_at
    on todo_items (cadence, status, created_at desc);

drop trigger if exists trg_todo_items_updated_at on todo_items;
create trigger trg_todo_items_updated_at
before update on todo_items
for each row
execute function set_updated_at();
