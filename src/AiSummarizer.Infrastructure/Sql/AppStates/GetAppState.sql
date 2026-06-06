select state_key, state_json::text as state_json, created_at, updated_at
from app_states
where state_key = @state_key;
