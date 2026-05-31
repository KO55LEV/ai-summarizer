# Практическое руководство: `.env`, Docker и worker-изоляция

Этот документ описывает, как держать окружение для `AiSummarizer` на VPS и в Docker, чтобы:

- API оставался легким и не выполнял тяжелую работу
- `worker` обрабатывал long-running jobs отдельно
- `whisper-service` жил как отдельный сервис
- секреты не попадали в git

## Базовая схема

Рекомендуемый набор сервисов:

- `api` - принимает запросы пользователя и создает jobs
- `worker` - читает jobs из БД и выполняет их
- `whisper-service` - отдельный сервис для транскрипции
- `postgres` - база данных

Эта схема работает так:

1. API принимает запрос.
2. API создает job в БД.
3. Worker забирает job по lease.
4. Worker запускает нужный обработчик.
5. Долгие операции выполняются внутри worker-процесса или дочернего процесса.
6. Результат и логи сохраняются в БД.

## Где держать `.env`

Для локального запуска и VPS удобно держать `.env` рядом с корневым `docker-compose.yml`:

```text
AiSummarizer/
  .env
  .env.example
  docker-compose.yml
  src/
  ui/
  whisper-service/
  db/
  docs/
```

Правило:

- `.env` не коммитить
- `.env.example` коммитить
- `.env` должен лежать рядом с `docker-compose.yml`, чтобы Docker Compose подхватывал его автоматически

Если нужен более строгий вариант для VPS, `.env` можно хранить вне репозитория в отдельной deploy-папке. Логика остается той же.

Для локального запуска `.NET` entrypoint-проекты читают `.env` автоматически через общий bootstrapper перед созданием host. В Docker переменные обычно приходят уже из окружения контейнера, и тогда они имеют приоритет над значениями из файла.

## Что класть в `.env`

В `.env` обычно кладут:

- параметры Postgres
- connection strings
- internal API keys
- JWT signing keys
- настройки worker
- настройки Whisper
- путь к `yt-dlp`

Пример набора переменных:

```env
POSTGRES_DB=AiSummarizer
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

ConnectionStrings__Postgres=Host=postgres;Port=5432;Database=AiSummarizer;Username=postgres;Password=postgres
InternalApiKey=change-me

Worker__WorkerId=worker-1
Worker__PollIntervalMilliseconds=1000
Worker__LeaseSeconds=60
Worker__HeartbeatSeconds=10
Worker__MaxConcurrentJobs=1

Workflows__OutputDirectory=/data/downloads/workflows
Jobs__YouTubeDownload__YtDlpExecutable=yt-dlp
Jobs__YouTubeDownload__MaxAttempts=3
Jobs__YouTubeDownload__RetryDelay=00:00:30
```

Workflow steps should derive their step folders from `Workflows__OutputDirectory` and the current `workflowId`. For example:

- `.../workflows/{workflowId}/download/`
- `.../workflows/{workflowId}/audio/`
- `.../workflows/{workflowId}/transcript/`
- `.../workflows/{workflowId}/import/`

## Как это работает в Docker

В Docker схема должна быть разнесена по контейнерам:

- один контейнер для API
- один контейнер для worker
- один контейнер для `whisper-service`
- один контейнер для Postgres

Плюсы такой схемы:

- API не блокируется длинными операциями
- worker можно масштабировать горизонтально
- `whisper-service` можно обновлять отдельно
- long-running job не ломает остальную систему

## Как worker выполняет долгие задачи

Worker не должен выполнять все в одном глобальном потоке.

Правильная модель:

- worker берет job из очереди в БД
- job лочится через lease
- worker запускает обработчик
- если нужно, обработчик создает отдельный child process, например `yt-dlp`
- progress и heartbeat пишутся в БД
- если worker падает, lease истекает, job становится доступной снова

Это позволяет безопасно работать с:

- YouTube download
- Whisper transcription
- генерацией summary
- другими long-running задачами

## Изоляция long-running процессов

Для каждого тяжелого job type должен быть свой обработчик:

- `youtube.download`
- `whisper.transcribe`
- `summary.generate`
- другие типы по мере роста продукта

Каждый handler может:

- запускать внешний процесс
- вызывать HTTP-сервис
- работать с файлами во временной директории
- репортить progress в процентах

Это и есть правильная изоляция:

- один job не блокирует весь API
- один job не блокирует другие jobs
- можно поднять несколько worker-инстансов

## Что важно для контейнера worker

Если worker запускает `yt-dlp`, внутри его образа должны быть:

- `yt-dlp`
- `ffmpeg`
- права на запись в output directory
- доступ к `/tmp`, если нужен временный storage

Если worker вызывает `whisper-service` по HTTP, то Python и `faster-whisper` в worker не нужны. Это правильно: Whisper живет отдельно.

## Рекомендация по VPS

Для VPS я бы запускал так:

```bash
docker compose up -d --build
```

Дальше каждый сервис работает отдельно:

- API обслуживает запросы
- Worker исполняет jobs
- Whisper транскрибирует
- Postgres хранит состояние

## Практический итог

Для проекта важно держать три уровня отдельно:

1. **Public API**
   - пользовательские запросы
   - создание jobs
   - получение результата

2. **Internal Worker**
   - чтение jobs
   - выполнение long-running процессов
   - логирование и progress

3. **External processing services**
   - `whisper-service`
   - другие отдельные сервисы, если появятся

Такой подход нормально масштабируется и не мешает развивать систему дальше.
