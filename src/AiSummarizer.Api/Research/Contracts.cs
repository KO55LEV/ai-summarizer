namespace AiSummarizer.Api.Research;

public sealed record CreateResearchTopicRequest(
    Guid? RequestedByUserId,
    string Name,
    string? Description,
    string Frequency,
    TimeOnly? DeliveryTime,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Outputs);

public sealed record UpdateResearchTopicRequest(
    string Name,
    string? Description,
    string Frequency,
    string Status,
    TimeOnly? DeliveryTime,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Outputs);

public sealed record CreateResearchBriefingRequest(
    Guid? RequestedByUserId,
    DateTimeOffset? GeneratedAt,
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    string PreviewText,
    DateTimeOffset? NextRunAt,
    IReadOnlyList<CreateResearchBriefingSectionRequest> Sections,
    IReadOnlyList<CreateResearchBriefingSourceRequest> Sources);

public sealed record CreateResearchBriefingSectionRequest(
    string Title,
    string Sentiment,
    IReadOnlyList<string> Items);

public sealed record CreateResearchBriefingSourceRequest(
    string Title,
    string Domain);

public sealed record ResearchTopicResponse(
    Guid Id,
    Guid? RequestedByUserId,
    string Name,
    string? Description,
    string Frequency,
    string Status,
    TimeOnly? DeliveryTime,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Outputs,
    int BriefingsCount,
    DateTimeOffset? LastRunAt,
    DateTimeOffset? NextRunAt,
    string? LastBriefingPreview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchStatsResponse(
    int ActiveTopics,
    int BriefingsGenerated,
    int SourcesTracked,
    int AvgReadTimeMinutes);

public sealed record ResearchListResponse(
    IReadOnlyList<ResearchTopicResponse> Topics,
    ResearchStatsResponse Stats);

public sealed record ResearchBriefingSectionResponse(
    string Title,
    string Sentiment,
    IReadOnlyList<string> Items);

public sealed record ResearchBriefingSourceResponse(
    string Title,
    string Domain);

public sealed record ResearchBriefingHistoryItemResponse(
    Guid Id,
    DateTimeOffset GeneratedAt,
    string PreviewText);

public sealed record ResearchBriefingResponse(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    string TopicName,
    DateTimeOffset GeneratedAt,
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    IReadOnlyList<ResearchBriefingSectionResponse> Sections,
    IReadOnlyList<ResearchBriefingSourceResponse> Sources,
    IReadOnlyList<ResearchBriefingHistoryItemResponse> PastBriefings,
    string PreviewText);
