namespace AiSummarizer.Infrastructure.Reasoning.Models;

public sealed class InceptionLabsOptions
{
    public const string SectionName = "ReasoningAI:InceptionLabs";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.inceptionlabs.ai";
    public string DefaultModel { get; set; } = "mercury";
    public int TimeoutSeconds { get; set; } = 60;
}
