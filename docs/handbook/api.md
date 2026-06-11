# API

The API is divided into a public layer and an internal layer.

## Users API

Base path: `/api/users`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/register` | User registration |
| POST | `/login` | Login via email/password |
| POST | `/google` | Login via Google access token |
| POST | `/facebook` | Login via Facebook access token |
| POST | `/refresh` | Refresh access/refresh tokens |
| POST | `/logout` | Logout the current session |
| GET | `/me` | Get current user details |

`Authorization` header format for `logout` and `me`:

- `Bearer <session-id>`

Note: This is technically a session GUID, not a JWT.

## Jobs API

Base path: `/internal/jobs`

Requires the following header:

- `X-Internal-Api-Key: <key>`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Create a job |
| GET | `/{jobId}` | Get a job by ID |
| GET | `/active` | Get active jobs |
| GET | `/history` | Get jobs history |
| GET | `/{jobId}/logs` | Get job logs |

This API is designed for worker processes and internal integrations.

## Workflows API

Base path: `/api/workflows`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/youtube-summary` | Create a `youtube.summary` workflow |
| GET | `/{workflowId}` | Get workflow details |
| GET | `/active` | Get active workflows |
| GET | `/history` | Get workflows history |
| GET | `/{workflowId}/steps` | Get workflow steps |
| GET | `/{workflowId}/events` | Get workflow events |

## Transcripts API

Base path: `/api/transcripts`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/youtube/schedule` | Publicly launch the transcript flow for a YouTube URL |
| GET | `/requests/{requestId}` | Get status and audit info for a single public request |
| GET | `/source/{sourceId}` | Get a completed transcript by `sourceId` |
| GET | `/history` | List of triggered transcript requests for the sidebar/history |

Endpoint Behavior:

1. Accepts `requestedByUserId`, `youtubeUrl`, `language`, `preferNativeTranscript`.
2. Validates that the input is a valid YouTube video URL.
3. Extracts the `media source` identity and checks if a completed transcript already exists for the `source_id`.
4. If a transcript already exists, returns it immediately with `status = completed`.
5. If there is an active workflow running for this URL, returns it with `status = queued`.
6. If no matches are found, creates a `youtube.transcript` workflow and returns `status = queued`.

This is the public entrypoint for scheduling the transcript pipeline. The actual execution is handled by the worker.

`POST /youtube/schedule` returns:

- `requestId`
- `status`
- `transcript` (if already completed)
- `workflow` (if processing is still in progress)

`GET /requests/{requestId}` returns a single audit run:

- `request`
- `response`
- `status`
- `workflowId`
- `transcriptId`
- `sourceId`
- `sourceUrl`
- `errorCode`
- `errorMessage`

`GET /source/{sourceId}` returns the completed transcript containing `transcriptText` and basic metadata. If the transcript is not yet ready, the endpoint returns `404`.

`GET /history` returns a list of recent transcript requests for the sidebar. The `requestedByUserId` filter is currently passed as a query parameter.

Each public request is also recorded in `public_request_runs` containing `api_area`, `operation_name`, `http_method`, `request_path`, `request_json`, `response_json`, `started_at`, and `finished_at`.
The API response returns the `requestId` to map the response back to its audit record.

`TranscriptHistoryItemResponse` provides additional derived fields for the UI:

- `displayStatus` for a human-readable status (`completed`, `queued`, `running`, `failed`, `cancelled`)
- `sourceLabel` for badges in the sidebar/history
- `language` and `durationSeconds` for compact card and table rendering

Response models:

- `TranscriptSummaryResponse`: transcript metadata + `transcriptText`
- `PublicRequestRunResponse`: full audit record for a single public request
- `TranscriptHistoryItemResponse`: compact history item for the left sidebar

## Research API

Base path: `/api/research`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List research topics (can filter by `requestedByUserId`) |
| POST | `/` | Create a research topic |
| GET | `/{topicId}` | Get a research topic |
| PUT | `/{topicId}` | Update a research topic |
| DELETE | `/{topicId}` | Delete a research topic |
| GET | `/{topicId}/briefing` | Get the latest briefing |
| GET | `/{topicId}/briefings` | Get briefing history |
| GET | `/{topicId}/history` | Alias for briefing history |
| POST | `/{topicId}/briefings` | Create a briefing record |

Research topics and briefings are currently user-scoped through `requestedByUserId`, as authentication is not yet fully wired.

Primary response models:

- `ResearchListResponse`
- `ResearchTopicResponse`
- `ResearchBriefingResponse`
- `ResearchBriefingHistoryItemResponse`

## Todos API

Base path: `/api/todos`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List todos (can filter by `requestedByUserId`, `projectId`, `cadence`, `status`) |
| GET | `/{todoId}` | Get a todo by ID |
| POST | `/` | Create a todo |
| PUT | `/{todoId}` | Update a todo |
| DELETE | `/{todoId}` | Delete a todo |

Todos are user-scoped through `requestedByUserId` and can be linked to `projects` via `projectId`.

Primary response models:

- `TodoListResponse`
- `TodoResponse`
- `TodoStatsResponse`

## Prompts API

Base path: `/api/prompts`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Create a prompt |
| GET | `/{promptId}` | Get a prompt by ID |
| GET | `/` | List prompts |
| PUT | `/{promptId}` | Update a prompt |
| DELETE | `/{promptId}` | Delete a prompt |
| GET | `/{promptId}/archive` | Get prompt version history |
| GET | `/{promptId}/runs` | Get prompt execution audit logs |
| GET | `/{promptId}/usage` | Get aggregated execution statistics |
| POST | `/{promptId}/runs` | Record a run audit manually or from the runtime |

## Errors

Errors are handled centrally via middleware and return JSON in the following format:

```json
{
  "status": 404,
  "detail": "Prompt not found."
}
```

Standard codes:

- `401 Unauthorized`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

