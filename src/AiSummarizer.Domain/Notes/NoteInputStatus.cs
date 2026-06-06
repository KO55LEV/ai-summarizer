namespace AiSummarizer.Domain.Notes;

public enum NoteInputStatus
{
    Queued = 0,
    Processing = 1,
    Succeeded = 2,
    Failed = 3,
    Skipped = 4
}
