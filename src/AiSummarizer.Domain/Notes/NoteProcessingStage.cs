namespace AiSummarizer.Domain.Notes;

public enum NoteProcessingStage
{
    Ingest = 0,
    Route = 1,
    Whisper = 2,
    Ocr = 3,
    Rewrite = 4,
    Summarize = 5
}
