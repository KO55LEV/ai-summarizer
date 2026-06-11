# Practical Guide: `.env`, Docker, and Worker Isolation

This document describes how to manage the environment for `AiSummarizer` on a VPS and in Docker to ensure:

- The API remains lightweight and does not perform heavy tasks
- The `worker` processes long-running jobs separately
- The `whisper-service` runs as a separate standalone service
- Secrets do not get committed to git

## Core Architecture

Recommended service stack:

- `api` - Accepts user requests and creates jobs
- `worker` - Polls jobs from the database and executes them
- `whisper-service` - Standalone service for transcription
- `postgres` - Database

The execution flow works as follows:

1. The API receives a request.
2. The API creates a job in the database.
3. The worker claims the job under a lease.
4. The worker runs the appropriate handler.
5. Long-running operations execute inside the worker process or as child processes.
6. Results and logs are saved back to the database.

## Where to keep `.env`

For local execution and VPS deployments, it is convenient to keep `.env` alongside the root `docker-compose.yml`:

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

Rules:

- Do NOT commit `.env` to git
- DO commit `.env.example` to git
- The `.env` file must reside in the same directory as `docker-compose.yml` so Docker Compose loads it automatically

If a more secure setup is needed for VPS, you can store `.env` outside the repository in a dedicated deployment folder. The logic remains the same.

For local execution, the .NET entry point projects automatically load `.env` via a shared bootstrapper before creating the host. In Docker, variables are typically provided from the container environment, which takes precedence over values in the file.

## What to put in `.env`

Common environment variables:

- Postgres parameters
- Connection strings
- Internal API keys
- Search provider API keys
- Email provider API keys
- Transcription provider defaults
- Reasoning provider keys and model defaults
- JWT signing keys
- Worker settings
- Whisper settings
- Path to `yt-dlp`

Example variable set:

```env
POSTGRES_DB=AiSummarizer
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

ConnectionStrings__Postgres=Host=postgres;Port=5432;Database=AiSummarizer;Username=postgres;Password=postgres
InternalApiKey=change-me
Tavily__ApiKey=
Tavily__BaseUrl=https://api.tavily.com

Email__Provider=Brevo
Email__DefaultFromEmail=no-reply@example.com
Email__DefaultFromName=AiSummarizer
Email__Brevo__ApiKey=
Email__Brevo__BaseUrl=https://api.brevo.com
Email__Brevo__TimeoutSeconds=60
Email__FileDump__FolderPath=/data/email-outbox
Transcribe__Provider=Whisper

ReasoningAI__OpenRouter__ApiKey=
ReasoningAI__OpenRouter__BaseUrl=https://openrouter.ai/api/v1
ReasoningAI__OpenRouter__DefaultModel=openai/gpt-4.1-mini

ReasoningAI__GoogleVertex__ProjectId=
ReasoningAI__GoogleVertex__Location=us-central1
ReasoningAI__GoogleVertex__CredentialsPath=
ReasoningAI__GoogleVertex__DefaultModel=gemini-2.5-pro

ReasoningAI__InceptionLabs__ApiKey=
ReasoningAI__InceptionLabs__BaseUrl=https://api.inceptionlabs.ai
ReasoningAI__InceptionLabs__DefaultModel=mercury

ReasoningAI__Ollama__BaseUrl=http://localhost:11434
ReasoningAI__Ollama__DefaultModel=llama3.1

Worker__WorkerId=worker-1
Worker__PollIntervalMilliseconds=1000
Worker__LeaseSeconds=60
Worker__HeartbeatSeconds=10
Worker__MaxConcurrentJobs=1

Workflows__OutputDirectory=/data/downloads/workflows
Jobs__YouTubeDownload__YtDlpExecutable=yt-dlp
Jobs__YouTubeDownload__MaxAttempts=3
Jobs__YouTubeDownload__RetryDelay=00:00:30
Jobs__OpenRouterTranscribe__ApiKey=
Jobs__OpenRouterTranscribe__BaseUrl=https://openrouter.ai/api/v1
Jobs__OpenRouterTranscribe__TranscribePath=/audio/transcriptions
Jobs__OpenRouterTranscribe__Model=whisper-1
Jobs__OpenRouterTranscribe__MaxAttempts=3
Jobs__OpenRouterTranscribe__RetryDelay=00:00:30
Jobs__OpenRouterTranscribe__RequestTimeoutSeconds=7200
```

Workflow steps should derive their step folders from `Workflows__OutputDirectory` and the current `workflowId`. For example:

- `.../workflows/{workflowId}/download/`
- `.../workflows/{workflowId}/audio/`
- `.../workflows/{workflowId}/transcript/`
- `.../workflows/{workflowId}/import/`

## How it works in Docker

In Docker, the architecture should be split across containers:

- One container for the API
- One container for the worker
- One container for the `whisper-service`
- One container for Postgres

Advantages of this setup:

- The API is not blocked by long-running operations
- The worker can scale horizontally
- The `whisper-service` can be updated independently
- A long-running job failure does not crash the rest of the system

If you use `Email__Provider=File` for local email dumps, mount the `Email__FileDump__FolderPath` folder in a volume to preserve emails outside the container.

## How the worker processes long-running tasks

The worker should not run everything in a single global thread.

Correct model:

- The worker polls jobs from the database queue
- The job is locked using a lease
- The worker invokes the appropriate handler
- If necessary, the handler spawns a separate child process (e.g., `yt-dlp`)
- Progress and heartbeats are written back to the database
- If the worker crashes, the lease expires and the job becomes available for polling again

This ensures safe handling of:

- YouTube downloads
- Whisper transcription
- Summary generation
- Other long-running tasks

## Long-Running Process Isolation

Each heavy job type should have its own handler:

- `youtube.download`
- `whisper.transcribe`
- `summary.generate`
- Other types as the product grows

Each handler can:

- Spawn an external process
- Call an HTTP service
- Process files in a temporary directory
- Report progress percentage

This provides proper isolation:

- A single job does not block the API
- A single job does not block other jobs
- Multiple worker instances can be spun up

## Important Worker Container Details

If the worker runs `yt-dlp`, its image must contain:

- `yt-dlp`
- `ffmpeg`
- Write permissions for the output directory
- Access to `/tmp` for temporary storage

If the worker calls `whisper-service` via HTTP, Python and `faster-whisper` are not required inside the worker image. This is correct: Whisper is kept separate. If you switch transcription providers later, the keys will remain in `.env`, and the provider configuration will be stored in application settings.

## VPS Recommendation

For VPS deployment, run via Docker Compose:

```bash
docker compose up -d --build
```

Each service then runs independently:

- The API serves requests
- The Worker processes jobs
- Whisper handles transcription
- Postgres stores state

## Practical Summary

It is critical to keep three layers separated:

1. **Public API**
   - Handles user requests
   - Creates jobs
   - Returns results

2. **Internal Worker**
   - Polls jobs
   - Executes long-running tasks
   - Logs status and progress

3. **External processing services**
   - `whisper-service`
   - Other specialized services as they are introduced

This approach scales cleanly and keeps system evolution straightforward.
�о job type должен быть свой обработчик:

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

Если worker вызывает `whisper-service` по HTTP, то Python и `faster-whisper` в worker не нужны. Это правильно: Whisper живет отдельно. Если позже переключишь transcription provider, ключи останутся в `.env`, а выбор будет храниться в `upsettings`.

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
