select id, research_topic_run_id, research_topic_run_phase_id, research_topic_id, status, scoring_version, total_documents, selected_documents, started_at, finished_at, error_code, error_message, metrics_json, created_at, updated_at
from research_ranking_runs
where research_topic_run_id = @research_topic_run_id
order by created_at asc;
