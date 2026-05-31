using System.Text.Json;

namespace AiSummarizer.Application.Prompts;

public sealed record PromptArchiveDto(
    Guid Id,
    Guid PromptId,
    int ArchiveVersion,
    string ArchiveReason,
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool IsActive,
    DateTimeOffset ArchivedAt,
    DateTimeOffset SourceUpdatedAt);

public sealed record PromptRunDto(
    Guid Id,
    Guid PromptId,
    Guid? WorkflowId,
    string? StepKey,
    string PromptKey,
    string Title,
    string? WorkflowType,
    string Provider,
    string Model,
    JsonElement Request,
    JsonElement? Response,
    string Status,
    string? ErrorCode,
    string? ErrorMessage,
    int? InputTokens,
    int? OutputTokens,
    int? TotalTokens,
    int? DurationMs,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record PromptRunUsageDto(
    Guid PromptId,
    int TotalRuns,
    int SucceededRuns,
    int FailedRuns,
    int RunningRuns,
    DateTimeOffset? LastRunAt,
    string? LastStatus);

public sealed record CreatePromptRunCommand(
    Guid? WorkflowId,
    string? StepKey,
    JsonElement Request,
    JsonElement? Response,
    string Status,
    string? ErrorCode,
    string? ErrorMessage,
    int? InputTokens,
    int? OutputTokens,
    int? TotalTokens,
    int? DurationMs,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt);
