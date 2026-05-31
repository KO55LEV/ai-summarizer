using System.Text.Json;

namespace AiSummarizer.Domain.Workflows;

public sealed record WorkflowStep
{
    public Guid Id { get; init; }
    public Guid WorkflowId { get; init; }
    public int StepOrder { get; init; }
    public string StepKey { get; init; } = string.Empty;
    public string StepType { get; init; } = string.Empty;
    public Guid? JobId { get; init; }
    public string Status { get; init; } = string.Empty;
    public JsonElement Input { get; init; }
    public JsonElement? Output { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
