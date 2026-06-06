select r.role_key
from user_roles ur
join roles r on r.id = ur.role_id
where ur.user_id = @user_id
order by r.role_key;
