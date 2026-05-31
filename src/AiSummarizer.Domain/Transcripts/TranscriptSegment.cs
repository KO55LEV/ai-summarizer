using System.Text.Json;

namespace AiSummarizer.Domain.Transcripts;

public sealed record TranscriptSegment
{
    public Guid Id { get; init; }
    public Guid TranscriptId { get; init; }
    public int SegmentIndex { get; init; }
    public decimal StartSeconds { get; init; }
    public decimal EndSeconds { get; init; }
    public int TextOffsetStart { get; init; }
    public int TextOffsetEnd { get; init; }
    public string Text { get; init; } = string.Empty;
    public string? SpeakerLabel { get; init; }
    public int WordCount { get; init; }
    public int CharacterCount { get; init; }
    public JsonElement Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
