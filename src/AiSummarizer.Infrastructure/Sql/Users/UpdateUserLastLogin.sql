update users
set last_login_at = @last_login_at
where id = @user_id;
