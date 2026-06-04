# Операции и запуск

## Локальный запуск

API:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/src
dotnet run --project AiSummarizer.Api
```

Worker:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/src
dotnet run --project AiSummarizer.Worker
```

Whisper service:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/whisper-service
docker compose up -d --build
```

## Environment

`AiSummarizer.Shared.EnvironmentBootstrapper`:

- ищет `.env` в текущей директории и выше
- подхватывает значения через `Environment.SetEnvironmentVariable`
- поддерживает подстановки вида `${VAR}`

Это означает:

- можно хранить `ConnectionStrings__Postgres` как шаблон
- можно переиспользовать переменные внутри `.env`

## Основные переменные

Минимум для запуска:

- `ConnectionStrings__Postgres`
- `InternalApi__ApiKey`
- `Tavily__ApiKey`
- `ReasoningAI__OpenRouter__ApiKey`
- `ReasoningAI__GoogleVertex__ProjectId`
- `ReasoningAI__GoogleVertex__CredentialsPath`
- `ReasoningAI__InceptionLabs__ApiKey`
- `ReasoningAI__Ollama__BaseUrl`
- `Users__*`
- `Worker__*`
- `Workflows__*`
- `Jobs__YouTubeDownload__*`
- `Jobs__MediaExtractAudio__*`
- `Jobs__WhisperTranscribe__*`

Примеры:

```env
POSTGRES_DB=AiSummarizer
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

ConnectionStrings__Postgres=Host=localhost;Port=5432;Database=AiSummarizer;Username=postgres;Password=postgres
InternalApi__ApiKey=change-me
Tavily__ApiKey=
Tavily__BaseUrl=https://api.tavily.com

ReasoningAI__OpenRouter__ApiKey=
ReasoningAI__OpenRouter__BaseUrl=https://openrouter.ai/api/v1
ReasoningAI__OpenRouter__DefaultModel=openai/gpt-4.1-mini
ReasoningAI__OpenRouter__TimeoutSeconds=60

ReasoningAI__GoogleVertex__ProjectId=
ReasoningAI__GoogleVertex__Location=us-central1
ReasoningAI__GoogleVertex__CredentialsPath=
ReasoningAI__GoogleVertex__DefaultModel=gemini-2.5-pro
ReasoningAI__GoogleVertex__TimeoutSeconds=60

ReasoningAI__InceptionLabs__ApiKey=
ReasoningAI__InceptionLabs__BaseUrl=https://api.inceptionlabs.ai
ReasoningAI__InceptionLabs__DefaultModel=mercury
ReasoningAI__InceptionLabs__TimeoutSeconds=60

ReasoningAI__Ollama__BaseUrl=http://localhost:11434
ReasoningAI__Ollama__DefaultModel=llama3.1
ReasoningAI__Ollama__TimeoutSeconds=60
ReasoningAI__Ollama__DefaultTemperature=0.7
ReasoningAI__Ollama__DefaultContextWindow=8192

Users__SessionLifetimeDays=30
Users__RefreshTokenLifetimeDays=30
Users__GoogleTokenInfoEndpoint=https://oauth2.googleapis.com/tokeninfo
Users__FacebookGraphBaseUrl=https://graph.facebook.com
Users__FacebookGraphVersion=v20.0
Users__FacebookAppId=your-facebook-app-id
Users__FacebookAppSecret=your-facebook-app-secret

Worker__WorkerId=worker-1
Worker__PollIntervalMilliseconds=1000
Worker__LeaseSeconds=60
Worker__HeartbeatSeconds=10
Worker__MaxConcurrentJobs=1

Workflows__PollIntervalSeconds=10
Workflows__LeaseSeconds=120
Workflows__OutputDirectory=./downloads/workflows
Jobs__YouTubeDownload__YtDlpExecutable=yt-dlp
Jobs__YouTubeDownload__MaxAttempts=3
Jobs__YouTubeDownload__RetryDelay=00:00:30
Jobs__MediaExtractAudio__FfmpegExecutable=ffmpeg
Jobs__MediaExtractAudio__MaxAttempts=3
Jobs__MediaExtractAudio__RetryDelay=00:00:30
Jobs__MediaExtractAudio__DefaultAudioFormat=m4a
Jobs__MediaExtractAudio__AudioBitrateKbps=192
Jobs__WhisperTranscribe__WhisperServiceBaseUrl=http://127.0.0.1:8000
Jobs__WhisperTranscribe__TranscribePath=/transcribe
Jobs__WhisperTranscribe__MaxAttempts=3
Jobs__WhisperTranscribe__RetryDelay=00:00:30
Jobs__WhisperTranscribe__RequestTimeoutSeconds=7200
Jobs__WhisperTranscribe__Language=en
```

## Seed workflow

Рекомендуемый порядок bootstrap:

1. применить миграции
2. загрузить seed user
3. загрузить roles
4. при необходимости создать demo jobs/workflows/prompts

## Диагностика

Если что-то не работает, сначала проверять:

- есть ли `.env`
- корректен ли `ConnectionStrings__Postgres`
- доступен ли Postgres
- верный ли `X-Internal-Api-Key`
- запущен ли `whisper-service`
- создает ли worker logs и пишет ли progress в БД

## Деплой

Предпочтительная схема:

- API отдельно
- Worker отдельно
- Whisper service отдельно
- PostgreSQL отдельно

Это позволяет:

- не держать тяжелую работу в API
- масштабировать worker независимо
- обновлять Whisper сервис без изменения API
