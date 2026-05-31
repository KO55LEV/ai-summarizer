using System.Text.Json;

namespace AiSummarizer.Domain.Workflows;

public sealed record WorkflowEvent
{
    public Guid Id { get; init; }
    public Guid WorkflowId { get; init; }
    public string? StepKey { get; init; }
    public string Level { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public JsonElement Context { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
