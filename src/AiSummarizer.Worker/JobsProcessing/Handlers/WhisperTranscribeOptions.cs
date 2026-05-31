namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class WhisperTranscribeOptions
{
    public string OutputDirectory { get; set; } = "./downloads/transcripts";
    public string WhisperServiceBaseUrl { get; set; } = "http://127.0.0.1:8000";
    public string TranscribePath { get; set; } = "/transcribe";
    public int MaxAttempts { get; set; } = 3;
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(30);
    public int RequestTimeoutSeconds { get; set; } = 7200;
    public string? Language { get; set; } = "en";
}
