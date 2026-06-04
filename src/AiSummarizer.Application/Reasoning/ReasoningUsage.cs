namespace AiSummarizer.Application.Reasoning;

public sealed record ReasoningUsage(int? PromptTokens, int? CompletionTokens, int? TotalTokens);
