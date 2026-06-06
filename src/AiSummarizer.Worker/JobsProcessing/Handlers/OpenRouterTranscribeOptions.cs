namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class OpenRouterTranscribeOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://openrouter.ai/api/v1";
    public string TranscribePath { get; set; } = "/audio/transcriptions";
    public string Model { get; set; } = "whisper-1";
    public int MaxAttempts { get; set; } = 3;
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(30);
    public int RequestTimeoutSeconds { get; set; } = 7200;
    public string? Language { get; set; }
}
