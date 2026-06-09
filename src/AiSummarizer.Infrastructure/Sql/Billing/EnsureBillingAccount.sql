insert into billing_accounts (user_id)
values (@user_id)
on conflict (user_id) do nothing;

