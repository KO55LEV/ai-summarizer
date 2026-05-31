namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class MediaExtractAudioOptions
{
    public string OutputDirectory { get; set; } = "./downloads/audio";
    public string FfmpegExecutable { get; set; } = "ffmpeg";
    public int MaxAttempts { get; set; } = 3;
    public TimeSpan RetryDelay { get; set; } = TimeSpan.FromSeconds(30);
    public string DefaultAudioFormat { get; set; } = "m4a";
    public int AudioBitrateKbps { get; set; } = 192;
}
