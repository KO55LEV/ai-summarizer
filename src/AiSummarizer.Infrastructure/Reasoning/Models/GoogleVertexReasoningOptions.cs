namespace AiSummarizer.Infrastructure.Reasoning.Models;

public sealed class GoogleVertexReasoningOptions
{
    public const string SectionName = "ReasoningAI:GoogleVertex";
    public string ProjectId { get; set; } = string.Empty;
    public string Location { get; set; } = "us-central1";
    public string? CredentialsPath { get; set; }
    public string DefaultModel { get; set; } = "gemini-2.5-pro";
    public int TimeoutSeconds { get; set; } = 60;
}
