namespace AiSummarizer.Domain.Transcripts;

public sealed record UserVideoLibraryItem
{
    public Guid Id { get; init; }
    public Guid RequestedByUserId { get; init; }
    public Guid MediaSourceId { get; init; }
    public Guid? ProjectId { get; init; }
    public Guid? PublicRequestRunId { get; init; }
    public Guid? WorkflowId { get; init; }
    public Guid? TranscriptId { get; init; }
    public string Status { get; init; } = string.Empty;
    public string SourceUrl { get; init; } = string.Empty;
    public DateTimeOffset? CompletedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
