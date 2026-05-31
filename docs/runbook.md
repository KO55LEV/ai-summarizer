# Runbook

## Local run

Run the API in one terminal:

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
