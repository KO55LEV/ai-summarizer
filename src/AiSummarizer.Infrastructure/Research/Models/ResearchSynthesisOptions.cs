namespace AiSummarizer.Infrastructure.Research.Models;

public sealed class ResearchSynthesisOptions
{
    public const string SectionName = "ResearchSynthesis";

    public string PromptKey { get; set; } = "research.briefing.summary";
    public string PromptVersion { get; set; } = "v1";
    public double Temperature { get; set; } = 0.2;
    public int MaxTokens { get; set; } = 3000;
    public int MaxSelectedDocuments { get; set; } = 18;
    public int MaxCharsPerDocument { get; set; } = 2400;
}
