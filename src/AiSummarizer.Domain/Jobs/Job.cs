using System.Text.Json;

namespace AiSummarizer.Domain.Jobs;

public sealed record Job
{
    public Guid Id { get; init; }
    public Guid? ParentJobId { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public string JobType { get; init; } = string.Empty;
    public int Priority { get; init; }
    public JobStatus Status { get; init; }
    public JsonElement Payload { get; init; }
    public JsonElement? Result { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public JsonElement? ErrorDetails { get; init; }
    public int AttemptCount { get; init; }
    public int MaxAttempts { get; init; }
    public DateTimeOffset AvailableAt { get; init; }
    public string? LockedBy { get; init; }
    public DateTimeOffset? LockedAt { get; init; }
    public DateTimeOffset? LockedUntil { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset? LastErrorAt { get; init; }
    public DateTimeOffset? HeartbeatAt { get; init; }
    public short? ProgressPercent { get; init; }
    public string? ProgressMessage { get; init; }
    public DateTimeOffset? CancelRequestedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
