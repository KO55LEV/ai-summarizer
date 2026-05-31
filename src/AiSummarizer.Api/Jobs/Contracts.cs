using System.Text.Json;

namespace AiSummarizer.Api.Jobs;

public sealed record CreateJobRequest(
    string JobType,
    JsonElement Payload,
    int? Priority,
    Guid? RequestedByUserId,
    Guid? ParentJobId,
    int? MaxAttempts);

public sealed record JobResponse(
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
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record JobLogResponse(
    Guid Id,
    Guid JobId,
    int? AttemptNo,
    string Level,
    string Message,
    JsonElement Context,
    DateTimeOffset CreatedAt);

public sealed record CreateJobResponse(JobResponse Job);
