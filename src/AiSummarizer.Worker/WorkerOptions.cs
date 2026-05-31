namespace AiSummarizer.Worker;

public sealed class WorkerOptions
{
    public string WorkerId { get; set; } = Environment.MachineName;
    public int PollIntervalMilliseconds { get; set; } = 1000;
    public int LeaseSeconds { get; set; } = 60;
    public int HeartbeatSeconds { get; set; } = 10;
    public int MaxConcurrentJobs { get; set; } = 1;
}
