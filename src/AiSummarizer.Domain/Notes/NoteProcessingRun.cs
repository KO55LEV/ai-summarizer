using System.Text.Json;

namespace AiSummarizer.Domain.Notes;

public sealed record NoteProcessingRun
{
    public Guid Id { get; init; }
    public Guid NoteId { get; init; }
    public Guid? JobId { get; init; }
    public Guid? SourceAssetId { get; init; }
    public NoteProcessingStage Stage { get; init; }
    public NoteProcessingStatus Status { get; init; } = NoteProcessingStatus.Queued;
    public string? Provider { get; init; }
    public string? Model { get; init; }
    public string? PromptVersion { get; init; }
    public string? InputHash { get; init; }
    public JsonElement? Request { get; init; }
    public JsonElement? Response { get; init; }
    public JsonElement? Output { get; init; }
    public JsonElement? Usage { get; init; }
    public JsonElement? Metrics { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
