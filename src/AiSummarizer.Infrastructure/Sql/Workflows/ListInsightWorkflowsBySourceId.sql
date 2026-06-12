select id, requested_by_user_id, source_id, workflow_type, status, input_json, result_json, current_step_key, error_code, error_message, attempt_count, max_attempts, available_at, locked_by, locked_at, locked_until, started_at, finished_at, heartbeat_at, progress_percent, progress_message, created_at, updated_at
from workflows
where source_id = @source_id
  and workflow_type in (
    'youtube.summary.quick_summary',
    'youtube.summary.key_takeaways',
    'youtube.summary.ask_this_video',
    'youtube.summary.study_guide'
  )
  and status = 'succeeded'
order by finished_at desc nulls last, created_at desc
limit @limit_value offset @offset_value;
