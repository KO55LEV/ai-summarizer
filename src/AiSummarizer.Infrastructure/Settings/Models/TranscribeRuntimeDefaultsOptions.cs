namespace AiSummarizer.Infrastructure.Settings.Models;

public sealed class TranscribeRuntimeDefaultsOptions
{
    public const string SectionName = "Transcribe";

    public string Provider { get; set; } = "Whisper";
}
