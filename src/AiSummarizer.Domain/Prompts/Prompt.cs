namespace AiSummarizer.Domain.Prompts;

public sealed record Prompt
{
    public Guid Id { get; init; }
    public string PromptKey { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? WorkflowType { get; init; }
    public string Provider { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public string SystemPrompt { get; init; } = string.Empty;
    public string UserPrompt { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record PromptArchive
{
    public Guid Id { get; init; }
    public Guid PromptId { get; init; }
    public int ArchiveVersion { get; init; }
    public string ArchiveReason { get; init; } = string.Empty;
    public string PromptKey { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? WorkflowType { get; init; }
    public string Provider { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public string SystemPrompt { get; init; } = string.Empty;
    public string UserPrompt { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public DateTimeOffset ArchivedAt { get; init; }
    public DateTimeOffset SourceUpdatedAt { get; init; }
}

public sealed record PromptRun
{
    public Guid Id { get; init; }
    public Guid PromptId { get; init; }
    public Guid? WorkflowId { get; init; }
    public string? StepKey { get; init; }
    public string PromptKey { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? WorkflowType { get; init; }
    public string Provider { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public System.Text.Json.JsonElement Request { get; init; }
    public System.Text.Json.JsonElement? Response { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public int? InputTokens { get; init; }
    public int? OutputTokens { get; init; }
    public int? TotalTokens { get; init; }
    public int? DurationMs { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record PromptRunUsage
{
    public Guid PromptId { get; init; }
    public int TotalRuns { get; init; }
    public int SucceededRuns { get; init; }
    public int FailedRuns { get; init; }
    public int RunningRuns { get; init; }
    public DateTimeOffset? LastRunAt { get; init; }
    public string? LastStatus { get; init; }
}
