namespace AiSummarizer.Application.Research;

public enum ResearchContentRunStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4
}

public enum ResearchContentItemStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4,
    Skipped = 5
}

public sealed record ResearchContentRunDto(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid? ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    ResearchContentRunStatus Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchContentRunRecord(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid? ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    ResearchContentRunStatus Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchContentItemDto(
    Guid Id,
    Guid ResearchContentRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string SourceUrl,
    string? CanonicalUrl,
    string Title,
    string? AuthorName,
    DateTimeOffset? PublishedAt,
    string FetchMethod,
    string ContentType,
    ResearchContentItemStatus Status,
    string? ContentHash,
    string? RawText,
    string? RawStoragePath,
    string? RawMetadataJson,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchContentItemRecord(
    Guid Id,
    Guid ResearchContentRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string SourceUrl,
    string? CanonicalUrl,
    string Title,
    string? AuthorName,
    DateTimeOffset? PublishedAt,
    string FetchMethod,
    string ContentType,
    ResearchContentItemStatus Status,
    string? ContentHash,
    string? RawText,
    string? RawStoragePath,
    string? RawMetadataJson,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
