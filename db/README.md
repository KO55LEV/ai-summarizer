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

