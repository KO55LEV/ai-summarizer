using System.Data.Common;

namespace AiSummarizer.Application.Research;

public interface ISearchProvider
{
    string ProviderName { get; }
    Task<IReadOnlyList<SearchResult>> SearchAsync(Guid? jobId, Guid? searchProviderKeyId, string query, int maxResults, string? apiKey = null, CancellationToken cancellationToken = default);
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

public interface IResearchRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IResearchRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<ResearchTopicDto?> GetTopicByIdAsync(Guid topicId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchTopicDto>> ListTopicsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<ResearchStatsDto> GetStatsAsync(Guid? requestedByUserId, CancellationToken cancellationToken);
    Task<Guid> CreateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> UpdateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteTopicAsync(Guid topicId, DbTransaction? transaction, CancellationToken cancellationToken);
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
}

public interface IResearchService
{
    Task<ResearchListDto> GetResearchListAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<ResearchTopicDto> GetTopicAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchTopicDto> CreateTopicAsync(CreateResearchTopicCommand command, CancellationToken cancellationToken);
    Task<ResearchTopicDto> UpdateTopicAsync(Guid topicId, UpdateResearchTopicCommand command, CancellationToken cancellationToken);
    Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken);
    Task<ResearchBriefingDto> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken);
    Task<ResearchBriefingDto> CreateBriefingAsync(Guid topicId, CreateResearchBriefingCommand command, CancellationToken cancellationToken);
}
