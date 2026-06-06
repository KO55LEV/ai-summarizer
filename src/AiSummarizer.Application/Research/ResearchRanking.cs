namespace AiSummarizer.Application.Research;

public enum ResearchRankingRunStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4
}

public sealed record ResearchRankingRunDto(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    ResearchRankingRunStatus Status,
    string ScoringVersion,
    int TotalDocuments,
    int SelectedDocuments,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchRankingRunRecord(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    ResearchRankingRunStatus Status,
    string ScoringVersion,
    int TotalDocuments,
    int SelectedDocuments,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchRankedDocumentDto(
    Guid Id,
    Guid ResearchRankingRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    Guid ResearchDocumentId,
    string SourceKey,
    string Title,
    string CanonicalUrl,
    double Score,
    double FreshnessScore,
    double SourceWeight,
    double LengthScore,
    int RankPosition,
    bool IsSelected,
    string ReasonJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchRankedDocumentRecord(
    Guid Id,
    Guid ResearchRankingRunId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    Guid ResearchDocumentId,
    string SourceKey,
    string Title,
    string CanonicalUrl,
    double Score,
    double FreshnessScore,
    double SourceWeight,
    double LengthScore,
    int RankPosition,
    bool IsSelected,
    string ReasonJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
