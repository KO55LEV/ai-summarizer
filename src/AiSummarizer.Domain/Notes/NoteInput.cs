using System.Text.Json;

namespace AiSummarizer.Domain.Notes;

public sealed record NoteInput
{
    public Guid Id { get; init; }
    public Guid NoteId { get; init; }
    public NoteSourceChannel SourceChannel { get; init; }
    public string? ExternalSourceId { get; init; }
    public string? ExternalMessageId { get; init; }
    public NoteInputKind InputKind { get; init; }
    public string? RawText { get; init; }
    public JsonElement RawPayload { get; init; }
    public NoteInputStatus Status { get; init; } = NoteInputStatus.Queued;
    public DateTimeOffset ReceivedAt { get; init; }
    public DateTimeOffset? ProcessedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
