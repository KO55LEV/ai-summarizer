alter table user_video_library
    add column if not exists project_id uuid null references projects(id) on delete set null;

create index if not exists ix_user_video_library_user_project_created_at
    on user_video_library (requested_by_user_id, project_id, created_at desc);
