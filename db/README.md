# Database migrations

This project uses SQL-first migrations.

Rules:

- every schema change gets a new file
- never edit old migrations after they are committed
- migrations are ordered by prefix number
- use one file per change set

Suggested layout:

```text
db/
  migrations/
    0001_create_users.sql
    0002_create_auth_identities.sql
    0003_...
```

All project tables live in `public`. Keep new tables there so the database stays single-schema unless we explicitly decide to split it later.

Seed data and manual test fixtures live in `db/seeds`.

Transcript data lives in three core tables:

- `transcripts` for the transcript root record and searchable plain text
- `transcript_segments` for timestamped segment rows
- `transcript_artifacts` for future AI outputs built from a transcript, such as summaries, quotes, quizzes, and study guides

Workflow data lives in:

- `workflows` for the user-facing orchestration state
- `workflow_steps` for each step inside a workflow
- `workflow_events` for the timeline / event log

Role data lives in:

- `roles` for reusable access roles such as `admin`, `user`, `moderator`, `editor`, `support`, and `viewer`
- `user_roles` for the many-to-many assignment between users and roles

`transcripts.source_url` stores the original YouTube URL when the transcript comes from a native subtitle source. `source_file_path` stays available for audio-backed transcripts and can be null when the transcript comes straight from the video source.
