import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel


MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
DEFAULT_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "").strip() or None

app = FastAPI()
model = WhisperModel(
    MODEL_NAME,
    device=DEVICE,
    compute_type=COMPUTE_TYPE,
    download_root="/models",
)


def _round_float(value: Any, digits: int) -> float:
    return round(float(value), digits)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile | None = File(default=None),
    language: str | None = Form(default=None),
) -> JSONResponse:
    if file is None:
        raise HTTPException(status_code=400, detail="file is required")

    suffix = Path(file.filename or "").suffix or ".mp3"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir="/tmp") as temp_file:
            temp_path = temp_file.name
            shutil.copyfileobj(file.file, temp_file)

        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True,
            word_timestamps=False,
            language=language or DEFAULT_LANGUAGE,
        )

        segment_items = [
            {
                "start": _round_float(segment.start, 2),
                "end": _round_float(segment.end, 2),
                "text": segment.text,
            }
            for segment in segments
        ]

        duration = getattr(info, "duration", 0.0)

        return JSONResponse(
            {
                "language": info.language,
                "languageProbability": _round_float(info.language_probability, 4),
                "duration": _round_float(duration, 2),
                "segments": segment_items,
            }
        )
    finally:
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        finally:
            await file.close()
