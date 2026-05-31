using System.Text.Json;

namespace AiSummarizer.Api.Workflows;

public sealed record CreateYoutubeSummaryWorkflowRequest(
    Guid? RequestedByUserId,
    string YoutubeUrl,
    string? Language,
    bool? PreferNativeTranscript);

public sealed record WorkflowResponse(
    Guid Id,
    Guid? RequestedByUserId,
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

public sealed record WorkflowStepResponse(
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

public sealed record WorkflowEventResponse(
    Guid Id,
    Guid WorkflowId,
    string? StepKey,
    string Level,
    string Message,
    JsonElement Context,
    DateTimeOffset CreatedAt);
