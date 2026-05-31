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
