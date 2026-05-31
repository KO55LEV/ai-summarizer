using System.Text.Json;

namespace AiSummarizer.Domain.Workflows;

public sealed record Workflow
{
    public Guid Id { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public Guid? SourceId { get; init; }
    public string WorkflowType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public JsonElement Input { get; init; }
    public JsonElement? Result { get; init; }
    public string? CurrentStepKey { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public int AttemptCount { get; init; }
    public int MaxAttempts { get; init; }
    public DateTimeOffset AvailableAt { get; init; }
    public string? LockedBy { get; init; }
    public DateTimeOffset? LockedAt { get; init; }
    public DateTimeOffset? LockedUntil { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset? HeartbeatAt { get; init; }
    public short? ProgressPercent { get; init; }
    public string? ProgressMessage { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
