update note_inputs
set note_id = @note_id,
    source_channel = @source_channel,
    external_source_id = @external_source_id,
    external_message_id = @external_message_id,
    input_kind = @input_kind,
    raw_text = @raw_text,
    raw_payload_json = @raw_payload_json,
    status = @status,
    received_at = @received_at,
    processed_at = @processed_at,
    created_at = @created_at,
    updated_at = @updated_at
where id = @id
returning id, note_id, source_channel, external_source_id, external_message_id, input_kind, raw_text, raw_payload_json::text as raw_payload_json, status, received_at, processed_at, created_at, updated_at;
