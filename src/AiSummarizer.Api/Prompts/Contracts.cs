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
