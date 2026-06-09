namespace AiSummarizer.Domain.Notes;

public sealed record NoteTextVersion
{
    public Guid Id { get; init; }
    public Guid NoteId { get; init; }
    public Guid? SourceAssetId { get; init; }
    public Guid? SourceRunId { get; init; }
    public NoteTextVersionKind VersionKind { get; init; } = NoteTextVersionKind.Original;
    public string Text { get; init; } = string.Empty;
    public string? Language { get; init; }
    public string? Provider { get; init; }
    public string? Model { get; init; }
    public string? PromptVersion { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
