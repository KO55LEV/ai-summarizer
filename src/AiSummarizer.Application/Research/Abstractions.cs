using System.Data.Common;

namespace AiSummarizer.Application.Research;

public interface ISearchProvider
{
    string ProviderName { get; }
    Task<IReadOnlyList<SearchResult>> SearchAsync(SearchProviderSearchRequest request, CancellationToken cancellationToken = default);
}

public sealed record SearchProviderSearchRequest(
    Guid? JobId,
    Guid? SearchProviderKeyId,
    string Query,
    int MaxResults,
    string? ApiKey = null,
    string? Topic = null,
    string? TimeRange = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    IReadOnlyList<string>? IncludeDomains = null,
    IReadOnlyList<string>? ExcludeDomains = null,
    bool IncludeAnswer = false,
    bool IncludeRawContent = false,
    bool IncludeImages = false,
    bool IncludeImageDescriptions = false,
    bool IncludeFavicon = false,
    string? Country = null,
    bool AutoParameters = false,
    string SearchDepth = "advanced");

public interface ISearchProviderFactory
{
    ISearchProvider GetProvider(string providerName);
    IReadOnlyList<string> ListProviderNames();
}

public interface ISearchProviderRepository
{
    Task<IReadOnlyList<SearchProviderKeyDto>> ListKeysAsync(CancellationToken cancellationToken);
    Task<SearchProviderKeyDto?> GetKeyAsync(Guid id, CancellationToken cancellationToken);
    Task<SearchProviderKeyDto> CreateKeyAsync(SearchProviderKeyDto key, CancellationToken cancellationToken);
    Task<SearchProviderKeyDto?> UpdateKeyAsync(Guid id, SearchProviderKeyDto key, CancellationToken cancellationToken);
    Task DeleteKeyAsync(Guid id, CancellationToken cancellationToken);
    Task<SearchProviderUsageDto> GetUsageAsync(Guid id, CancellationToken cancellationToken);
    Task LogRequestAsync(string provider, Guid? searchProviderKeyId, Guid? jobId, string requestPayload, int responseStatus, CancellationToken cancellationToken);
}

public sealed record SearchProviderKeyDto(
    Guid Id,
    string Provider,
    string ApiKey,
    int QuotaPerMonth,
    bool IsActive,
    string? Note);

public sealed record SearchProviderUsageDto(
    Guid Id,
    string Provider,
    int QuotaPerMonth,
    int Used,
    DateTimeOffset CycleStart,
    DateTimeOffset CycleEnd);

public sealed record SearchProviderQuotaDto(
    int MaxQuota,
    int Used,
    DateTimeOffset CycleStart,
    DateTimeOffset CycleEnd);

public interface ISearchQueryPlanner
{
    IReadOnlyList<ResearchSearchQuery> BuildQueries(ResearchSearchPlan plan, string frequency, string? lookbackWindow);
}

public interface IResearchSearchPlanningService
{
    Task<ResearchSearchPlanRecord> EnsureSearchPlanAsync(Guid topicId, Guid? workflowId, Guid? jobId, string? stepKey, bool forceRefresh, CancellationToken cancellationToken);
}

public interface IResearchRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IResearchRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<ResearchTopicDto?> GetTopicByIdAsync(Guid topicId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicDto>> ListTopicsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicDto>> ListDueActiveTopicsAsync(DateTimeOffset dueAt, int limit, CancellationToken cancellationToken);
    Task<bool> HasActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchActiveTopicRunDto?> GetActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchStatsDto> GetStatsAsync(Guid? requestedByUserId, CancellationToken cancellationToken);
    Task<Guid> CreateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> UpdateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteTopicAsync(Guid topicId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateTopicNextRunAtAsync(Guid topicId, DateTimeOffset? nextRunAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchSearchPlanRecord?> GetSearchPlanByTopicIdAsync(Guid topicId, CancellationToken cancellationToken);
    Task<Guid> UpsertSearchPlanAsync(ResearchSearchPlanRecord plan, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceTopicSourcesAsync(Guid topicId, IReadOnlyList<string> sources, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceTopicTagsAsync(Guid topicId, IReadOnlyList<string> tags, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceTopicOutputsAsync(Guid topicId, IReadOnlyList<string> outputs, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<int> GetBriefingCountAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchBriefingDto?> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchBriefingDto?> GetBriefingByIdAsync(Guid briefingId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken);
    Task<Guid> CreateBriefingAsync(ResearchBriefingRecord briefing, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceBriefingSectionsAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSectionInput> sections, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceBriefingSourcesAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSourceInput> sources, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateTopicBriefingStateAsync(Guid topicId, DateTimeOffset? lastRunAt, DateTimeOffset? nextRunAt, string? lastBriefingPreview, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> CreateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<bool> CancelTopicRunByWorkflowIdAsync(Guid workflowId, string reason, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchTopicRunDto?> GetTopicRunByIdAsync(Guid runId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicRunDto>> ListTopicRunsAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicRunDto>> ListActiveTopicRunJobsAsync(Guid topicId, CancellationToken cancellationToken);
    Task<Guid> CreateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchTopicRunPhaseDto?> GetTopicRunPhaseAsync(Guid runId, string phaseKey, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicRunPhaseDto>> ListTopicRunPhasesAsync(Guid runId, CancellationToken cancellationToken);
    Task<Guid> CreateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> CreateSearchResultAsync(ResearchSearchResultRecord result, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchSearchResultDto>> ListSearchResultsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken);
    Task<Guid> CreateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchContentRunDto?> GetContentRunByIdAsync(Guid contentRunId, CancellationToken cancellationToken);
    Task<Guid> CreateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchContentItemDto>> ListContentItemsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken);
    Task<Guid> CreateDocumentAsync(ResearchDocumentRecord document, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> CreateDocumentChunkAsync(ResearchDocumentChunkRecord chunk, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchDocumentDto>> ListDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchDocumentChunkDto>> ListDocumentChunksAsync(Guid researchDocumentId, CancellationToken cancellationToken);
    Task<Guid> CreateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchRankingRunDto?> GetRankingRunByIdAsync(Guid rankingRunId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchRankingRunDto>> ListRankingRunsAsync(Guid researchTopicRunId, CancellationToken cancellationToken);
    Task<Guid> CreateRankedDocumentAsync(ResearchRankedDocumentRecord rankedDocument, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchRankedDocumentDto>> ListRankedDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken);
    Task<Guid> CreateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<ResearchSynthesisRunDto?> GetSynthesisRunByIdAsync(Guid synthesisRunId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchSynthesisRunDto>> ListSynthesisRunsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken);
}

public interface IResearchService
{
    Task<ResearchListDto> GetResearchListAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<ResearchTopicDto> GetTopicAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchTopicDto> CreateTopicAsync(CreateResearchTopicCommand command, CancellationToken cancellationToken);
    Task<ResearchTopicDto> UpdateTopicAsync(Guid topicId, UpdateResearchTopicCommand command, CancellationToken cancellationToken);
    Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchBriefingDto> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchBriefingDto> GetBriefingAsync(Guid topicId, Guid briefingId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken);
    Task<ResearchBriefingDto> CreateBriefingAsync(Guid topicId, CreateResearchBriefingCommand command, CancellationToken cancellationToken);
}
