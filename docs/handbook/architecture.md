# Architecture and Modules

The project is built as a SQL-first monolith with a clear separation of layers.

## Layers

### `AiSummarizer.Api`

HTTP API layer:

- Accepts user requests
- Validates input data
- Invokes application services
- Returns JSON responses

### `AiSummarizer.Worker`

Background process:

- Polls jobs from the database
- Executes long-running processing tasks
- Supports workflow orchestration
- Writes progress and logs back to the database

### `AiSummarizer.Application`

Use-case layer:

- `UsersService`
- `JobsService`
- `WorkflowsService`
- `PromptsService`

This layer contains the core business logic.

### `AiSummarizer.Domain`

Pure domain models:

- `User`
- `Session`
- `Job`
- `Workflow`
- `Prompt`

### `AiSummarizer.Infrastructure`

Storage and integrations:

- PostgreSQL via `Npgsql`
- SQL scripts in `src/**/Sql`
- Data access repositories
- External auth verifier for Google/Facebook

### `AiSummarizer.Shared`

Common startup infrastructure:

- Loading `.env`
- Resolving `${VAR}` expansions inside env files
- Reused by both API and Worker

## Dependency Flow

The rule is simple:

- `Api` -> `Application`
- `Worker` -> `Application`
- `Application` -> `Domain`
- `Infrastructure` -> `Application` and `Domain`
- `Shared` -> Used during startup, does not contain business logic

## Why it is built this way

- SQL-first migrations and SQL scripts are easier to review
- Background tasks do not block the HTTP API
- Workflow state can be recovered from the database
- Prompts can be tuned and archived independently of code

