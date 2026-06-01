# AiSummarizer Handbook

Это основная документация проекта `AiSummarizer`.

Цель проекта:

- загружать видео с YouTube
- извлекать аудио
- транскрибировать аудио через Whisper
- импортировать транскрипт в базу
- запускать и аудировать LLM-промпты для summary, Q&A и других задач

Ключевые разделы:

- [Обзор системы](overview.md)
- [Архитектура и модули](architecture.md)
- [База данных](database.md)
- [API](api.md)
- [Jobs и workflow](workflows.md)
- [Prompts и LLM-аудит](prompts.md)
- [Пользователи, роли и безопасность](security.md)
- [Операции и запуск](operations.md)
- [UI (React frontend)](ui.md)

Примечание:

- старые файлы в `docs/runbook.md` и `docs/deployment-worker-guide.md` оставлены как рабочие заметки
- новый набор документации в `docs/handbook/` должен считаться основным
