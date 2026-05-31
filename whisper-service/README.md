# Whisper Service

This service provides a small HTTP API for audio transcription using FastAPI and `faster-whisper`.

It is intended to be called by a .NET API or any other backend over HTTP.

## Build and start

```bash
docker compose up -d --build
```

## Health check

```bash
curl http://127.0.0.1:8000/health
```

## Transcribe an mp3

```bash
curl -X POST http://127.0.0.1:8000/transcribe -F "file=@/path/to/audio.mp3" -o transcript.json
```

By default the service uses English. If you want to force another language, send a multipart `language` field, for example `ru` or `es`.

## Storage behavior

Uploaded audio or video files are written only to a temporary file in `/tmp` during processing and deleted immediately after transcription completes, even when transcription fails.

Whisper models are cached in the Docker volume named `whisper-models`, mounted at `/models`.
