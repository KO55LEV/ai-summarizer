namespace AiSummarizer.Application.Research;

public enum ResearchSearchPlanStatus
{
    Pending = 1,
    Ready = 2,
    Stale = 3,
    Failed = 4
}

public sealed record ResearchSearchSourcePlan(
    string Source,
    IReadOnlyList<string> Queries,
    string? Recency = null,
    IReadOnlyList<string>? ExcludeTerms = null,
    int? MaxResults = null);

public sealed record ResearchSearchPlan(
    string TopicSummary,
    string? Language,
    IReadOnlyList<string> Keywords,
    IReadOnlyList<string> Entities,
    IReadOnlyList<string> NegativeTerms,
    IReadOnlyList<ResearchSearchSourcePlan> SourcePlans);

public sealed record ResearchSearchPlanRecord(
    Guid Id,
    Guid ResearchTopicId,
    int PlanVersion,
    string PromptKey,
    string PromptVersion,
    string Provider,
    string Model,
    ResearchSearchPlanStatus Status,
    string? PlanJson,
    string InputHash,
    string? SourceHash,
    DateTimeOffset? GeneratedAt,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed class ResearchSearchPlanningException(string errorCode, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public string ErrorCode { get; } = errorCode;
}

public sealed record StartResearchTopicPlanCommand(
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    string TriggeredBy,
    bool ForceRefresh = false);
