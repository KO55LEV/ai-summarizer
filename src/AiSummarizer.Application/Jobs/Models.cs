using System.Text.Json;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Application.Jobs;

public sealed record JobDto(
    Guid Id,
    Guid? ParentJobId,
    Guid? RequestedByUserId,
    string JobType,
    int Priority,
    string Status,
    JsonElement Payload,
    JsonElement? Result,
    string? ErrorCode,
    string? ErrorMessage,
    JsonElement? ErrorDetails,
    int AttemptCount,
    int MaxAttempts,
    DateTimeOffset AvailableAt,
    string? LockedBy,
    DateTimeOffset? LockedAt,
    DateTimeOffset? LockedUntil,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? LastErrorAt,
    DateTimeOffset? HeartbeatAt,
    short? ProgressPercent,
    string? ProgressMessage,
    DateTimeOffset? CancelRequestedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record JobLogDto(
    Guid Id,
    Guid JobId,
    int? AttemptNo,
    string Level,
    string Message,
    JsonElement Context,
    DateTimeOffset CreatedAt);

public sealed record CreateJobCommand(
    string JobType,
    JsonElement Payload,
    int Priority,
    Guid? RequestedByUserId,
    Guid? ParentJobId,
    int MaxAttempts);

public sealed record JobsListResult(
    IReadOnlyList<JobDto> Items);

public sealed record CreateJobResult(
    JobDto Job);
