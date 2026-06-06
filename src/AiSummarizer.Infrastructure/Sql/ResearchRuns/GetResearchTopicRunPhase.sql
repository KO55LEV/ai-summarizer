select id, research_topic_run_id, phase_key, status, attempt_count, started_at, finished_at, error_code, error_message, metrics_json, created_at, updated_at
from research_topic_run_phases
where research_topic_run_id = @run_id and phase_key = @phase_key;
