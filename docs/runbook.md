# Runbook

## Local run

Run the API and worker together:

```bash
./scripts/dev-backend.sh
```

The script loads `.env`, starts both backend processes, prefixes logs with `api` or `worker`, and stops both on `Ctrl+C`.

Restart both backend processes:

```bash
Ctrl+C
./scripts/dev-backend.sh
```

Run the API manually in one terminal:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/src
dotnet run --project AiSummarizer.Api
```

Run the worker in another terminal:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/src
dotnet run --project AiSummarizer.Worker
```

## VPS Whisper Tunnel

```bash
ssh -L 8000:127.0.0.1:8000 root@217.154.37.35
```

Use this tunnel to reach the Whisper service running on the VPS locally on `http://127.0.0.1:8000`.

## Whisper Service

Local run:

```bash
cd /Volumes/Data/Devs/Projects/AiSummarizer/whisper-service
docker compose up -d --build
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Transcribe audio:

```bash
curl -X POST http://127.0.0.1:8000/transcribe -F "file=@/path/to/audio.m4a" -o transcript.json
```



curl -i -X POST http://localhost:5000/api/transcripts/youtube/schedule \
  -H 'Content-Type: application/json' \
  -d '{
    "requestedByUserId": "617a8af2-bae2-43a6-938f-7c384e3061ee",
    "youtubeUrl": "https://www.youtube.com/watch?v=2umezqgYxJ4",
    "language": "ru",
    "preferNativeTranscript": true
  }'
