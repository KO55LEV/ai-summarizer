namespace AiSummarizer.Domain.Jobs;

public enum JobStatus
{
    Queued = 0,
    RetryWait = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4,
    Cancelled = 5,
    Dead = 6
}
