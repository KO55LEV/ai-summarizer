namespace AiSummarizer.Infrastructure.Reasoning.Models;

public sealed class OllamaOptions
{
    public const string SectionName = "ReasoningAI:Ollama";
    public string BaseUrl { get; set; } = "http://localhost:11434";
    public string DefaultModel { get; set; } = "llama3.1";
    public int TimeoutSeconds { get; set; } = 60;
    public double DefaultTemperature { get; set; } = 0.7;
    public int DefaultContextWindow { get; set; } = 8192;
}
