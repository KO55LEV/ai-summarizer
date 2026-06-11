# Prompts and LLM Audit

The prompts system is designed to manage LLM templates as data rather than as code.

## Why it is needed

- Different workflows may require different prompts
- The same prompt can be tuned without redeploying code
- Multiple provider/model combinations can be stored
- Usage audits can track exactly how a prompt was used

## Core Entity

`prompts` stores the currently active version of a template.

Fields:

- `prompt_key`
- `title`
- `description`
- `workflow_type`
- `provider`
- `model`
- `system_prompt`
- `user_prompt`
- `is_active`
- `created_at`
- `updated_at`

### Technical Purpose of Fields

- `prompt_key` - A stable slug for technical identification
- `workflow_type` - Links to a workflow type if the prompt is part of a workflow sequence
- `provider` - Vendor name, e.g., OpenAI or other providers
- `model` - Specific model identifier
- `system_prompt` - System instructions
- `user_prompt` - User part of the request
- `is_active` - Allows disabling a template without deleting it

## Prompt Archive

`prompt_archive` stores immutable snapshots.

A snapshot is created:

- On `INSERT`
- On `UPDATE`
- On `DELETE`

This is useful for:

- Viewing change history
- Comparing old and new versions
- Reverting to versions that worked better in the past

Each snapshot contains:

- All prompt text fields
- `archive_version`
- `archive_reason`
- `archived_at`
- `source_updated_at`

## Audit Runs

`prompt_runs` stores prompt execution events.

It preserves:

- Request JSON
- Response JSON
- Status
- `error_code`
- `error_message`
- Token usage
- Duration
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

This enables building audit records for:

- Number of times a prompt has run
- Number of successful runs vs. failed runs
- The exact request sent
- The exact response received
- Number of tokens consumed
- Execution duration

## API

The API for prompts already allows you to:

- Create
- Read
- Update
- Delete
- View version archives
- View execution runs
- View usage summaries
- Log run audits manually

## Current State

Prompts are already separated as a distinct subsystem, but the runtime integration with workflow chains can be expanded separately.

Next logical steps:

- Select a prompt dynamically by `workflow_type + provider + model`
- Use `prompt_runs` at the moment of the actual LLM call
- Build metrics for quality and invocation frequency

## JSON Output for Synthesis

For workflows where downstream systems expect JSON, the prompt instructions should be very strict:

- Explicitly demand `only valid JSON` in the `system_prompt`
- Forbid explanatory text before or after the JSON body
- Validate the result before saving it

If a model returns malformed JSON:

1. Check `prompt_runs.request_json` and `prompt_runs.response_json`
2. Check `research_synthesis_runs.response_json` and `research_synthesis_runs.output_json`
3. Update the prompt text or increment the `prompt_version`
4. Switch to a more robust provider/model combination if necessary
5. Rerun synthesis for the same `research_topic_run_id`

Best practices for this workflow:

- Keep the prompt version as a mandatory audit field
- Use `response_format=json` or the provider-specific equivalent setting
- Treat malformed JSON as a distinct failure mode rather than a silent parse success

