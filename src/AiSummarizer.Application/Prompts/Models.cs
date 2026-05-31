namespace AiSummarizer.Application.Prompts;

public sealed record PromptDto(
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

public sealed record CreatePromptCommand(
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool IsActive);

public sealed record UpdatePromptCommand(
    string PromptKey,
    string Title,
    string? Description,
    string? WorkflowType,
    string Provider,
    string Model,
    string SystemPrompt,
    string UserPrompt,
    bool IsActive);
