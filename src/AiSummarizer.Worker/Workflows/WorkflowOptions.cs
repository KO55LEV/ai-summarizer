namespace AiSummarizer.Worker.Workflows;

public sealed class WorkflowOptions
{
    public int PollIntervalSeconds { get; set; } = 10;
    public int LeaseSeconds { get; set; } = 120;
    public string OutputDirectory { get; set; } = "./downloads/workflows";
}
