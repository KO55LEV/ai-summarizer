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
