update sessions
set last_used_at = @last_used_at
where id = @session_id;
