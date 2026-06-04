namespace AiSummarizer.Application.Research;

public enum ResearchSearchSource
{
    Web = 1,
    News = 2,
    Archive = 3,
    Reddit = 4,
    Financial = 5,
    Twitter = 6,
    YouTube = 7
}

public sealed record ResearchSearchQuery(
    string Query,
    ResearchSearchSource Source,
    DateTimeOffset? StartDate = null,
    DateTimeOffset? EndDate = null,
    int MaxResults = 10);

public sealed record ResearchSearchResult(
    ResearchSearchSource Source,
    string Query,
    string Url,
    string Title,
    string Content,
    double Score,
    string RawResponse);

public interface IResearchSearchSourceAdapter
{
    ResearchSearchSource Source { get; }
    string DisplayName { get; }
    Task<IReadOnlyList<ResearchSearchResult>> SearchAsync(ResearchSearchQuery query, CancellationToken cancellationToken = default);
}

public interface IResearchSearchSourceRegistry
{
    IResearchSearchSourceAdapter Get(ResearchSearchSource source);
    IReadOnlyList<ResearchSearchSourceDescriptor> List();
}

public sealed record ResearchSearchSourceDescriptor(
    ResearchSearchSource Source,
    string Key,
    string DisplayName,
    string Description);
