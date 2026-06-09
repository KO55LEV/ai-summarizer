namespace AiSummarizer.Worker;

public sealed class ResearchSchedulerOptions
{
    public bool Enabled { get; init; } = true;
    public int PollIntervalSeconds { get; init; } = 60;
    public int BatchSize { get; init; } = 50;
}
