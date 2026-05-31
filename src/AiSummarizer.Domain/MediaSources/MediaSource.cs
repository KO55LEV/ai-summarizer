using System.Text.Json;

namespace AiSummarizer.Domain.MediaSources;

public sealed record MediaSource
{
    public Guid Id { get; init; }
    public string SourceProvider { get; init; } = string.Empty;
    public string SourceKind { get; init; } = string.Empty;
    public string ExternalSourceId { get; init; } = string.Empty;
    public string CanonicalUrl { get; init; } = string.Empty;
    public string OriginalUrl { get; init; } = string.Empty;
    public decimal? DurationSeconds { get; init; }
    public bool? NativeTranscriptAvailable { get; init; }
    public DateTimeOffset? NativeTranscriptCheckedAt { get; init; }
    public string? NativeTranscriptLanguage { get; init; }
    public JsonElement Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
