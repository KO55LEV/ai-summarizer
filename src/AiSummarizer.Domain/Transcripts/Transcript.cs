using System.Text.Json;

namespace AiSummarizer.Domain.Transcripts;

public sealed record Transcript
{
    public Guid Id { get; init; }
    public Guid JobId { get; init; }
    public Guid? SourceJobId { get; init; }
    public string SourceFilePath { get; init; } = string.Empty;
    public string TranscriptFilePath { get; init; } = string.Empty;
    public string Language { get; init; } = string.Empty;
    public decimal LanguageProbability { get; init; }
    public decimal DurationSeconds { get; init; }
    public int SegmentCount { get; init; }
    public int WordCount { get; init; }
    public int CharacterCount { get; init; }
    public string TranscriptText { get; init; } = string.Empty;
    public JsonElement Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
