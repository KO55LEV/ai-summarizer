namespace AiSummarizer.Api.Prompts;

public sealed record CreatePromptRequest(
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool? IsActive);

public sealed record UpdatePromptRequest(
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool IsActive);

public sealed record PromptResponse(
    Guid Id,
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record PromptArchiveResponse(
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

public sealed record PromptRunResponse(
    Guid Id,
    Guid PromptId,
    Guid? WorkflowId,
    string? StepKey,
    string PromptKey,
    string Title,
    string? WorkflowType,
    string Provider,
    string Model,
    System.Text.Json.JsonElement Request,
    System.Text.Json.JsonElement? Response,
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

public sealed record PromptRunUsageResponse(
    Guid PromptId,
    int TotalRuns,
    int SucceededRuns,
    int FailedRuns,
    int RunningRuns,
    DateTimeOffset? LastRunAt,
    string? LastStatus);

public sealed record CreatePromptRunRequest(
    Guid? WorkflowId,
    string? StepKey,
    System.Text.Json.JsonElement Request,
    System.Text.Json.JsonElement? Response,
    string Status,
    string? ErrorCode,
    string? ErrorMessage,
    int? InputTokens,
    int? OutputTokens,
    int? TotalTokens,
    int? DurationMs,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);
