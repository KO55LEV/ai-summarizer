alter table if exists todo_items
    add column if not exists color text null;
