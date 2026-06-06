select id, note_id, source_channel, external_source_id, external_message_id, input_kind, raw_text, raw_payload_json::text as raw_payload_json, status, received_at, processed_at, created_at, updated_at
from note_inputs
where source_channel = @source_channel
  and external_source_id = @external_source_id
  and external_message_id = @external_message_id;
