# System Overview

`AiSummarizer` is a .NET application for video and text processing followed by analysis via LLM.

Main scenario:

1. The user creates a workflow based on a YouTube URL.
2. The worker checks if a native transcript is available.
3. If a transcript is available, it is imported directly.
4. If there is no transcript, the workflow goes through download -> extract audio -> whisper transcribe -> transcript import.
5. Results, logs, and intermediate states are saved in PostgreSQL.
6. After this, LLM prompts can be run on top of the transcript.

What is already in the project:

- User authentication
- Internal jobs API for worker processes
- Workflow orchestration for `youtube.summary`
- Role tables and user-role relations
- CRUD for prompts
- Archive history for prompts
- Audit log for prompt runs

What the project does not do on its own:

- Does not store business logic in API controllers
- Does not perform heavy tasks inside the API
- Does not bind prompts to a specific LLM provider at the runtime level automatically, unless implemented by a separate service

Runtime layers:

- `AiSummarizer.Api` - public HTTP API
- `AiSummarizer.Worker` - background jobs and workflow processor
- `AiSummarizer.Infrastructure` - SQL-first access to PostgreSQL
- `AiSummarizer.Application` - use cases and services
- `AiSummarizer.Domain` - domain models
- `AiSummarizer.Shared` - shared configuration bootstrap

