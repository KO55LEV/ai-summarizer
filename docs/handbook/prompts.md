# Prompts и LLM-аудит

Система prompts нужна для управления LLM-шаблонами как данными, а не как кодом.

## Зачем это нужно

- разные workflow могут требовать разные промпты
- один и тот же prompt можно тюнить без redeploy
- можно хранить несколько provider/model комбинаций
- можно вести аудит того, как именно prompt был использован

## Основная сущность

`prompts` хранит текущую активную версию шаблона.

Поля:

- `prompt_key`
- `title`
- `description`
- `workflow_type`
- `provider`
- `model`
- `system_prompt`
- `user_prompt`
- `is_active`
- `created_at`
- `updated_at`

### Практический смысл полей

- `prompt_key` - стабильный slug для технической идентификации
- `workflow_type` - привязка к типу workflow, если prompt используется в workflow-цепочке
- `provider` - vendor, например OpenAI или другой провайдер
- `model` - конкретная модель
- `system_prompt` - системная инструкция
- `user_prompt` - пользовательская часть запроса
- `is_active` - позволяет выключать шаблон без удаления

## Архив промптов

`prompt_archive` хранит immutable snapshots.

Снимок создается:

- при `INSERT`
- при `UPDATE`
- при `DELETE`

Это нужно для:

- просмотра истории изменений
- сравнения старых и новых формулировок
- восстановления решений, которые работали раньше

Каждый snapshot содержит:

- все текстовые поля промпта
- `archive_version`
- `archive_reason`
- `archived_at`
- `source_updated_at`

## Audit runs

`prompt_runs` хранит события использования промпта.

Сохраняются:

- request JSON
- response JSON
- статус
- error_code
- error_message
- token usage
- duration
- started_at
- finished_at
- created_at
- updated_at

Это позволяет строить аудит:

- сколько раз prompt запускался
- сколько запусков успешны
- сколько провалились
- какой request был отправлен
- какой response был получен
- сколько токенов ушло
- сколько длился вызов

## API

API для prompts уже позволяет:

- создавать
- читать
- обновлять
- удалять
- смотреть архив
- смотреть runs
- смотреть usage summary
- писать run audit вручную

## Текущее состояние

Сейчас prompts уже выделены как отдельная подсистема, но runtime-интеграция с workflow-цепочкой может быть расширена отдельно.

Нормальный следующий шаг:

- выбирать prompt по `workflow_type + provider + model`
- использовать `prompt_runs` в момент реального LLM-вызова
- строить метрики по качеству и частоте запуска

## JSON-вывод для synthesis

Для workflow, где downstream ожидает JSON, запрос должен быть максимально жестким:

- в `system_prompt` явно требовать `only valid JSON`
- не добавлять пояснительный текст до или после JSON
- валидировать результат до сохранения

Если модель вернула malformed JSON:

1. посмотреть `prompt_runs.request_json` и `prompt_runs.response_json`
2. посмотреть `research_synthesis_runs.response_json` и `research_synthesis_runs.output_json`
3. обновить `prompt_version` или текст промпта
4. при необходимости переключить provider/model на более стабильный
5. rerun synthesis для того же `research_topic_run_id`

Практика для этого workflow:

- хранить prompt version как обязательный audit field
- держать `response_format=json` или эквивалент provider-specific setting
- считать malformed JSON отдельным failure mode, а не silent parse success
