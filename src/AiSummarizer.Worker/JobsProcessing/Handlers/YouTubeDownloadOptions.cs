namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class YouTubeDownloadOptions
{
    public string YtDlpExecutable { get; set; } = "yt-dlp";
    public int MaxAttempts { get; set; } = 3;
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(30);
}
