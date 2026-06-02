# API

API разделен на публичный слой и internal слой.

## Users API

Базовый путь: `/api/users`

| Method | Path | Назначение |
| --- | --- | --- |
| POST | `/register` | регистрация пользователя |
| POST | `/login` | логин по email/password |
| POST | `/google` | логин через Google access token |
| POST | `/facebook` | логин через Facebook access token |
| POST | `/refresh` | обновление access/refresh token |
| POST | `/logout` | logout текущей сессии |
| GET | `/me` | текущий пользователь |

Формат `Authorization` для `logout` и `me`:

- `Bearer <session-id>`

Технически это GUID сессии, а не JWT.

## Jobs API

Базовый путь: `/internal/jobs`

Требует заголовок:

- `X-Internal-Api-Key: <key>`

| Method | Path | Назначение |
| --- | --- | --- |
| POST | `/` | создать job |
| GET | `/{jobId}` | получить job |
| GET | `/active` | активные jobs |
| GET | `/history` | история jobs |
| GET | `/{jobId}/logs` | логи job |

Этот API предназначен для worker-процессов и внутренних интеграций.

## Workflows API

Базовый путь: `/api/workflows`

| Method | Path | Назначение |
| --- | --- | --- |
| POST | `/youtube-summary` | создать workflow `youtube.summary` |
| GET | `/{workflowId}` | получить workflow |
| GET | `/active` | активные workflows |
| GET | `/history` | история workflows |
| GET | `/{workflowId}/steps` | шаги workflow |
| GET | `/{workflowId}/events` | события workflow |

## Transcripts API

Базовый путь: `/api/transcripts`

| Method | Path | Назначение |
| --- | --- | --- |
| POST | `/youtube/schedule` | публично запустить transcript flow для YouTube URL |
| GET | `/requests/{requestId}` | получить статус и audit одного public-запроса |
| GET | `/source/{sourceId}` | получить готовый transcript по `sourceId` |
| GET | `/history` | список запущенных transcript requests для sidebar/history |

Поведение endpoint:

1. принимает `requestedByUserId`, `youtubeUrl`, `language`, `preferNativeTranscript`
2. валидирует, что это YouTube video URL
3. извлекает `media source` identity и проверяет, есть ли уже готовый transcript по `source_id`
4. если transcript уже есть, возвращает его сразу со `status = completed`
5. если есть активный workflow для этого URL, возвращает его со `status = queued`
6. если ничего не найдено, создает workflow `youtube.transcript` и отдает `status = queued`

Это публичный entrypoint для scheduling transcript pipeline. Само исполнение делает worker.

`POST /youtube/schedule` возвращает:

- `requestId`
- `status`
- `transcript` если уже готов
- `workflow` если обработка ещё идёт

`GET /requests/{requestId}` возвращает один audit-run:

- `request`
- `response`
- `status`
- `workflowId`
- `transcriptId`
- `sourceId`
- `sourceUrl`
- `errorCode`
- `errorMessage`

`GET /source/{sourceId}` возвращает готовый transcript с `transcriptText` и базовыми метаданными. Если transcript ещё не готов, endpoint возвращает `404`.

`GET /history` возвращает список recent transcript requests для sidebar. Фильтр `requestedByUserId` пока передаётся query-параметром.

Каждый public-запрос также пишется в `public_request_runs` с `api_area`, `operation_name`, `http_method`, `request_path`, `request_json`, `response_json`, `started_at` и `finished_at`.
В ответе API возвращается `requestId`, чтобы можно было сопоставить ответ с audit-записью.

`TranscriptHistoryItemResponse` дополнительно отдаёт derived-поля для UI:

- `displayStatus` для человекочитаемого статуса (`completed`, `queued`, `running`, `failed`, `cancelled`)
- `sourceLabel` для badge в sidebar/history
- `language` и `durationSeconds` для компактного отображения карточек и таблиц

Response models:

- `TranscriptSummaryResponse`: transcript metadata + `transcriptText`
- `PublicRequestRunResponse`: full audit record for a single public request
- `TranscriptHistoryItemResponse`: compact history item for the left sidebar

## Research API

Базовый путь: `/api/research`

| Method | Path | Назначение |
| --- | --- | --- |
| GET | `/` | список research topics, можно фильтровать по `requestedByUserId` |
| POST | `/` | создать research topic |
| GET | `/{topicId}` | получить topic |
| PUT | `/{topicId}` | обновить topic |
| DELETE | `/{topicId}` | удалить topic |
| GET | `/{topicId}/briefing` | получить latest briefing |
| GET | `/{topicId}/briefings` | история briefings |
| GET | `/{topicId}/history` | alias для истории briefings |
| POST | `/{topicId}/briefings` | создать briefing record |

Research topics and briefings are user-scoped through `requestedByUserId`, because auth is not wired yet.

Primary response models:

- `ResearchListResponse`
- `ResearchTopicResponse`
- `ResearchBriefingResponse`
- `ResearchBriefingHistoryItemResponse`

## Prompts API

Базовый путь: `/api/prompts`

| Method | Path | Назначение |
| --- | --- | --- |
| POST | `/` | создать prompt |
| GET | `/{promptId}` | получить prompt |
| GET | `/` | список prompts |
| PUT | `/{promptId}` | обновить prompt |
| DELETE | `/{promptId}` | удалить prompt |
| GET | `/{promptId}/archive` | история версий prompt |
| GET | `/{promptId}/runs` | audit runs промпта |
| GET | `/{promptId}/usage` | агрегированная статистика запусков |
| POST | `/{promptId}/runs` | записать run audit вручную или из runtime |

## Ошибки

Ошибки централизованы через middleware и возвращают JSON вида:

```json
{
  "status": 404,
  "detail": "Prompt not found."
}
```

Типовые коды:

- `401 Unauthorized`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`
