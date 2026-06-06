insert into app_states (
    state_key,
    state_json
)
values (
    @state_key,
    @state_json
)
on conflict (state_key) do update
set state_json = excluded.state_json;
