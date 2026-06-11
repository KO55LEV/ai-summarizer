# Operations and Launch

## Local Launch

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

- Searches for `.env` in the current directory and parent directories
- Loads values using `Environment.SetEnvironmentVariable`
- Supports variable substitutions using the `${VAR}` format

This means:

- You can store `ConnectionStrings__Postgres` as a template
- You can reuse variables within `.env`

## Core Variables

Minimum requirements for launch:

- `ConnectionStrings__Postgres`
- `InternalApi__ApiKey`
- `Tavily__ApiKey`
- `Email__*`
- `Transcribe__*`
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

Email provider choices:

- `Email__Provider=Brevo` sends through Brevo
- `Email__Provider=File` dumps messages into `Email__FileDump__FolderPath`

Examples:

```env
POSTGRES_DB=AiSummarizer
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

ConnectionStrings__Postgres=Host=localhost;Port=5432;Database=AiSummarizer;Username=postgres;Password=postgres
InternalApi__ApiKey=change-me
Tavily__ApiKey=
Tavily__BaseUrl=https://api.tavily.com

Email__Provider=Brevo
Email__DefaultFromEmail=no-reply@example.com
Email__DefaultFromName=AiSummarizer
Email__Brevo__ApiKey=
Email__Brevo__BaseUrl=https://api.brevo.com
Email__Brevo__TimeoutSeconds=60
Email__FileDump__FolderPath=./data/email-outbox
Transcribe__Provider=Whisper

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
Jobs__OpenRouterTranscribe__ApiKey=
Jobs__OpenRouterTranscribe__BaseUrl=https://openrouter.ai/api/v1
Jobs__OpenRouterTranscribe__TranscribePath=/audio/transcriptions
Jobs__OpenRouterTranscribe__Model=whisper-1
Jobs__OpenRouterTranscribe__MaxAttempts=3
Jobs__OpenRouterTranscribe__RetryDelay=00:00:30
Jobs__OpenRouterTranscribe__RequestTimeoutSeconds=7200
```

## Workflow Seeding

Recommended bootstrap order:

1. Apply migrations
2. Load seed user
3. Load roles
4. Create demo jobs/workflows/prompts if necessary

## Diagnostics

If something is not working, check the following first:

- Is the `.env` file present?
- Is `ConnectionStrings__Postgres` correct?
- Is Postgres accessible?
- Is `X-Internal-Api-Key` correct?
- Is `whisper-service` running?
- Is the worker producing logs and writing progress to the DB?

### Research synthesis JSON failures

If `research.topic.synthesize` fails during response parsing:

- Check `research_synthesis_runs.response_json`
- Check `research_synthesis_runs.output_json`
- Check `prompt_runs.request_json` and `prompt_runs.response_json` (if synthesis uses prompt audits)
- Compare the provider's response against the expected JSON schema
- If necessary, update the prompt and bump `ResearchSynthesis__PromptVersion`
- Rerun synthesis for the same `research_topic_run_id`

## Deployment

Preferred scheme:

- API hosted separately
- Worker hosted separately
- Whisper service hosted separately
- PostgreSQL hosted separately

This allows you to:

- Avoid handling heavy operations inside the API process
- Scale workers independently
- Update the Whisper service without affecting the API

