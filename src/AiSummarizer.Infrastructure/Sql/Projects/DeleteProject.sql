update projects
set status = 'deleted',
    updated_at = now()
where id = @project_id;
