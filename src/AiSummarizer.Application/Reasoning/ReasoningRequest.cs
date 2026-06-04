namespace AiSummarizer.Application.Reasoning;

public sealed record ReasoningRequest(
    string? Model,
    string? SystemPrompt,
    string? UserPrompt,
    IReadOnlyList<ReasoningMessage>? Messages = null,
    double? Temperature = null,
    int? MaxTokens = null,
    string? ResponseFormat = null);
