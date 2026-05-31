# Архитектура и модули

Проект построен как SQL-first монолит с четким разделением на слои.

## Слои

### `AiSummarizer.Api`

HTTP API слой:

- принимает пользовательские запросы
- валидирует входные данные
- вызывает application services
- возвращает JSON-ответы

### `AiSummarizer.Worker`

Фоновый процесс:

- забирает jobs из БД
- исполняет long-running обработку
- поддерживает workflow orchestration
- пишет прогресс и логи обратно в БД

### `AiSummarizer.Application`

Use-case слой:

- `UsersService`
- `JobsService`
- `WorkflowsService`
- `PromptsService`

Здесь находится основная бизнес-логика.

### `AiSummarizer.Domain`

Чистые доменные модели:

- `User`
- `Session`
- `Job`
- `Workflow`
- `Prompt`

### `AiSummarizer.Infrastructure`

Хранилище и интеграции:

- PostgreSQL через `Npgsql`
- SQL-скрипты в `src/**/Sql`
- репозитории для доступа к данным
- external auth verifier для Google/Facebook

### `AiSummarizer.Shared`

Общая инфраструктура старта:

- загрузка `.env`
- расширение `${VAR}` внутри env-файлов
- переиспользуется API и worker

## Направление зависимостей

Правило простое:

- `Api` -> `Application`
- `Worker` -> `Application`
- `Application` -> `Domain`
- `Infrastructure` -> `Application` и `Domain`
- `Shared` -> используется на старте, но не содержит бизнес-логики

## Почему так сделано

- SQL-first миграции и SQL-скрипты проще ревьюить
- фоновые задачи не блокируют HTTP API
- workflow state можно восстановить из БД
- prompts можно тюнить и архивировать независимо от кода
