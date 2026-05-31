using System.Text.Json;

namespace AiSummarizer.Application.Workflows;

public sealed record WorkflowDto(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? SourceId,
    string WorkflowType,
    string Status,
    JsonElement Input,
    JsonElement? Result,
    string? CurrentStepKey,
    string? ErrorCode,
    string? ErrorMessage,
    int AttemptCount,
    int MaxAttempts,
    DateTimeOffset AvailableAt,
    string? LockedBy,
    DateTimeOffset? LockedAt,
    DateTimeOffset? LockedUntil,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? HeartbeatAt,
    short? ProgressPercent,
    string? ProgressMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record WorkflowStepDto(
    Guid Id,
    Guid WorkflowId,
    int StepOrder,
    string StepKey,
    string StepType,
    Guid? JobId,
    string Status,
    JsonElement Input,
    JsonElement? Output,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record WorkflowEventDto(
    Guid Id,
    Guid WorkflowId,
    string? StepKey,
    string Level,
    string Message,
    JsonElement Context,
    DateTimeOffset CreatedAt);

public sealed record CreateYoutubeSummaryWorkflowCommand(
    Guid? RequestedByUserId,
    string YoutubeUrl,
    string? Language,
    bool PreferNativeTranscript);
