namespace AiSummarizer.Application.Research;

public sealed record SearchResult(
    string Url,
    string Title,
    string Content,
    string RawResponse);

public sealed record ResearchTopicDto(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
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

public sealed record ResearchTopicRecord(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string Name,
    string? Description,
    string Frequency,
    string Status,
    TimeOnly? DeliveryTime,
    DateTimeOffset? LastRunAt,
    DateTimeOffset? NextRunAt,
    string? LastBriefingPreview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchStatsDto(
    int ActiveTopics,
    int BriefingsGenerated,
    int SourcesTracked,
    int AvgReadTimeMinutes);

public sealed record ResearchListDto(
    IReadOnlyList<ResearchTopicDto> Topics,
    ResearchStatsDto Stats);

public sealed record ResearchBriefingSectionInput(
    string Title,
    string Sentiment,
    IReadOnlyList<string> Items);

public sealed record ResearchBriefingSourceInput(
    string Title,
    string Domain);

public sealed record CreateResearchTopicCommand(
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string Name,
    string? Description,
    string Frequency,
    string Status,
    TimeOnly? DeliveryTime,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Outputs);

public sealed record UpdateResearchTopicCommand(
    Guid? ProjectId,
    string Name,
    string? Description,
    string Frequency,
    string Status,
    TimeOnly? DeliveryTime,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Outputs);

public sealed record CreateResearchBriefingCommand(
    Guid? RequestedByUserId,
    DateTimeOffset GeneratedAt,
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    string PreviewText,
    DateTimeOffset? NextRunAt,
    IReadOnlyList<ResearchBriefingSectionInput> Sections,
    IReadOnlyList<ResearchBriefingSourceInput> Sources);

public sealed record ResearchBriefingRecord(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    int BriefingVersion,
    DateTimeOffset GeneratedAt,
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    string PreviewText,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchBriefingHistoryItemDto(
    Guid Id,
    DateTimeOffset GeneratedAt,
    string PreviewText);

public sealed record ResearchBriefingSectionDto(
    string Title,
    string Sentiment,
    IReadOnlyList<string> Items);

public sealed record ResearchBriefingSourceDto(
    string Title,
    string Domain);

public sealed record ResearchBriefingDto(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    string TopicName,
    DateTimeOffset GeneratedAt,
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    IReadOnlyList<ResearchBriefingSectionDto> Sections,
    IReadOnlyList<ResearchBriefingSourceDto> Sources,
    IReadOnlyList<ResearchBriefingHistoryItemDto> PastBriefings,
    string PreviewText);
