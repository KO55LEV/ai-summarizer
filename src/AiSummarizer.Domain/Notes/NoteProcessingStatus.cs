namespace AiSummarizer.Domain.Notes;

public enum NoteProcessingStatus
{
    Queued = 0,
    Running = 1,
    Succeeded = 2,
    Failed = 3,
    Retrying = 4,
    Cancelled = 5
}
