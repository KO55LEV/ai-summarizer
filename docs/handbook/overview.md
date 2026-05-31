# Обзор системы

`AiSummarizer` - это .NET-приложение для обработки видео и текста с последующим анализом через LLM.

Основной сценарий:

1. Пользователь создает workflow на основе YouTube URL.
2. Worker проверяет, есть ли native transcript.
3. Если transcript есть, он импортируется напрямую.
4. Если transcript нет, workflow идет через download -> extract audio -> whisper transcribe -> transcript import.
5. Результаты, журналы и промежуточные состояния сохраняются в PostgreSQL.
6. После этого поверх transcript можно запускать LLM-промпты.

Что уже есть в проекте:

- пользовательская аутентификация
- internal jobs API для worker-процессов
- workflow orchestration для `youtube.summary`
- таблицы ролей и связей user-role
- CRUD для prompts
- archive history для prompts
- audit log для prompt runs

Что проект не делает сам по себе:

- не хранит бизнес-логику в API-контроллерах
- не выполняет тяжелые задачи внутри API
- не привязывает prompts к конкретному LLM provider на уровне runtime автоматически, если это не реализовано отдельным сервисом

Runtime-слои:

- `AiSummarizer.Api` - публичный HTTP API
- `AiSummarizer.Worker` - фоновые jobs и workflow processor
- `AiSummarizer.Infrastructure` - SQL-first доступ к PostgreSQL
- `AiSummarizer.Application` - use cases и сервисы
- `AiSummarizer.Domain` - доменные модели
- `AiSummarizer.Shared` - общий bootstrap конфигурации
