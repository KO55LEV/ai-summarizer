update notes
set status = 'deleted',
    updated_at = now()
where id = @note_id;
