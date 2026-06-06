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

public sealed record StartResearchTopicRunRequest(
    Guid? RequestedByUserId,
    string? TriggeredBy,
    bool ForceRun);

public sealed record StartResearchTopicRunResponse(
    Guid JobId,
    Guid TopicId,
    string JobType);

public sealed record ResearchTopicRunResponse(
    Guid Id,
    Guid ResearchTopicId,
    Guid? RequestedByUserId,
    Guid? JobId,
    string Status,
    string? TriggeredBy,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? NextRetryAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? SummaryPreview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchTopicRunPhaseResponse(
    Guid Id,
    Guid ResearchTopicRunId,
    string PhaseKey,
    string Status,
    int AttemptCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchContentRunResponse(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid? ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    string? MetricsJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchContentItemResponse(
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
    string Status,
    string? ContentHash,
    string? RawText,
    string? RawStoragePath,
    string? RawMetadataJson,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchDocumentResponse(
    Guid Id,
    Guid ResearchContentItemId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string CanonicalUrl,
    string Title,
    string? AuthorName,
    DateTimeOffset? PublishedAt,
    DateTimeOffset NormalizedAt,
    string CanonicalBody,
    string CanonicalHash,
    string RawContentHash,
    string SourceProvenanceJson,
    string NormalizerVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchDocumentChunkResponse(
    Guid Id,
    Guid ResearchDocumentId,
    int ChunkIndex,
    string? ChunkTitle,
    string ChunkText,
    int TokenCount,
    int StartOffset,
    int EndOffset,
    string ChunkHash,
    string ChunkMetadataJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchRankingRunResponse(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    string Status,
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

public sealed record ResearchRankedDocumentResponse(
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

public sealed record ResearchSynthesisRunResponse(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    Guid ResearchRankingRunId,
    string Status,
    string ReasoningProvider,
    string Model,
    string PromptVersion,
    string InputHash,
    string? RequestJson,
    string? ResponseJson,
    string? OutputJson,
    string? UsageJson,
    int SelectedDocumentCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    Guid? ResearchBriefingId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSearchResultResponse(
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

public sealed record ResearchTopicResponse(
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
