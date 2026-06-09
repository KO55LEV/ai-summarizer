alter table todo_items
    add column if not exists bucket text not null default 'today';

update todo_items
set bucket = case
    when due_at is null then 'today'
    when due_at::date <= current_date then 'today'
    else 'next'
end;

alter table todo_items
    drop constraint if exists ck_todo_items_bucket;

alter table todo_items
    add constraint ck_todo_items_bucket check (bucket in ('today', 'next', 'later'));

create index if not exists ix_todo_items_requested_by_bucket_created_at
    on todo_items (requested_by_user_id, bucket, created_at desc);
