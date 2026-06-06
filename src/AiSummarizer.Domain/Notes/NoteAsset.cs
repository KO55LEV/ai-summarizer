using System.Text.Json;

namespace AiSummarizer.Domain.Notes;

public sealed record NoteAsset
{
    public Guid Id { get; init; }
    public Guid NoteId { get; init; }
    public Guid? NoteInputId { get; init; }
    public string AssetType { get; init; } = string.Empty;
    public string MimeType { get; init; } = string.Empty;
    public string StorageKey { get; init; } = string.Empty;
    public string? OriginalFilename { get; init; }
    public long? SizeBytes { get; init; }
    public string? ChecksumSha256 { get; init; }
    public decimal? DurationSeconds { get; init; }
    public int? Width { get; init; }
    public int? Height { get; init; }
    public JsonElement Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
