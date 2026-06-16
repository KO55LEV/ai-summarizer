namespace AiSummarizer.Infrastructure.Research.Models;

public sealed class ResearchSearchPlanningOptions
{
    public const string SectionName = "ResearchSearchPlanning";

    public string PromptKey { get; set; } = "research.search.plan";
    public string PromptVersion { get; set; } = "v1";
}
