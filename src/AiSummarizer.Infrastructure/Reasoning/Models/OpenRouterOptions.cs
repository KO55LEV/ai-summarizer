namespace AiSummarizer.Infrastructure.Reasoning.Models;

public sealed class OpenRouterOptions
{
    public const string SectionName = "ReasoningAI:OpenRouter";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://openrouter.ai/api/v1";
    public string DefaultModel { get; set; } = "openai/gpt-4.1-mini";
    public int TimeoutSeconds { get; set; } = 60;
}
