using AiSummarizer.Application.Reasoning;

namespace AiSummarizer.Infrastructure.Research.Models;

public sealed class ResearchSynthesisOptions
{
    public const string SectionName = "ResearchSynthesis";

    public ReasoningProvider Provider { get; set; } = ReasoningProvider.OpenRouter;
    public string? Model { get; set; }
    public string PromptVersion { get; set; } = "v1";
    public double Temperature { get; set; } = 0.2;
    public int MaxTokens { get; set; } = 3000;
    public int MaxSelectedDocuments { get; set; } = 18;
    public int MaxCharsPerDocument { get; set; } = 2400;
}
