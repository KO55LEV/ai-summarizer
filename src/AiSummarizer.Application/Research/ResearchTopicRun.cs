namespace AiSummarizer.Application.Research;

public enum ResearchTopicRunStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4,
    Cancelled = 5
}

public enum ResearchTopicRunPhaseStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4,
    Skipped = 5,
    Retrying = 6
}

public enum ResearchSearchRunStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4
}

public sealed record ResearchTopicRunDto(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    Guid? JobId,
    Guid? WorkflowId,
    ResearchTopicRunStatus Status,
    string? TriggeredBy,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? NextRetryAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? SummaryPreview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchActiveTopicRunDto(
    Guid Id,
    Guid? JobId,
    Guid? WorkflowId,
    string Status,
    DateTimeOffset CreatedAt);

public sealed record ResearchTopicRunPhaseDto(
    Guid Id,
    Guid ResearchTopicRunId,
    string PhaseKey,
    ResearchTopicRunPhaseStatus Status,
    int AttemptCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchTopicRunRecord(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    Guid? JobId,
    Guid? WorkflowId,
    ResearchTopicRunStatus Status,
    string? TriggeredBy,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? NextRetryAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? SummaryPreview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchTopicRunPhaseRecord(
    Guid Id,
    Guid ResearchTopicRunId,
    string PhaseKey,
    ResearchTopicRunPhaseStatus Status,
    int AttemptCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSearchRunDto(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    string SourceKey,
    string PlannerVersion,
    int QueryCount,
    ResearchSearchRunStatus Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSearchRunRecord(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    string SourceKey,
    string PlannerVersion,
    int QueryCount,
    ResearchSearchRunStatus Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSearchResultDto(
    Guid Id,
    Guid ResearchSearchRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string Query,
    string Title,
    string Url,
    string? CanonicalUrl,
    string? Snippet,
    double Score,
    DateTimeOffset? PublishedAt,
    string? AuthorName,
    string? Domain,
    string? Language,
    int ResultRank,
    string RawResultJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSearchResultRecord(
    Guid Id,
    Guid ResearchSearchRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string Query,
    string Title,
    string Url,
    string? CanonicalUrl,
    string? Snippet,
    double Score,
    DateTimeOffset? PublishedAt,
    string? AuthorName,
    string? Domain,
    string? Language,
    int ResultRank,
    string RawResultJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record StartResearchTopicRunCommand(
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    string TriggeredBy,
    bool ForceRun = false);
