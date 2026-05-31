using System.Text.Json;

namespace AiSummarizer.Domain.PublicRequests;

public sealed record PublicRequestRun
{
    public Guid Id { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public string ApiArea { get; init; } = "public";
    public string OperationName { get; init; } = string.Empty;
    public string HttpMethod { get; init; } = string.Empty;
    public string RequestPath { get; init; } = string.Empty;
    public Guid? SourceId { get; init; }
    public string? SourceProvider { get; init; }
    public string? SourceKind { get; init; }
    public string? ExternalSourceId { get; init; }
    public string? SourceUrl { get; init; }
    public Guid? WorkflowId { get; init; }
    public Guid? TranscriptId { get; init; }
    public JsonElement Request { get; init; }
    public JsonElement? Response { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
