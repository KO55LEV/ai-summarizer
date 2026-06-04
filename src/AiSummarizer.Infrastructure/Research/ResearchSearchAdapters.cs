using AiSummarizer.Application.Reasoning;
using AiSummarizer.Application.Research;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Research;

public abstract class TavilyResearchSearchSourceAdapter(
    TavilySearchProvider searchProvider,
    IOptions<ResearchSearchSourceOptions> options,
    ILogger logger) : IResearchSearchSourceAdapter
{
    public abstract ResearchSearchSource Source { get; }
    public abstract string DisplayName { get; }

    public async Task<IReadOnlyList<ResearchSearchResult>> SearchAsync(ResearchSearchQuery query, CancellationToken cancellationToken = default)
    {
        var request = BuildRequest(query, options.Value);
        var results = await searchProvider.SearchAsync(request, cancellationToken);
        return results.Select(result => new ResearchSearchResult(Source, query.Query, result.Url, result.Title, result.Content, 0d, result.RawResponse)).ToArray();
    }

    protected abstract SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options);
}

public sealed class WebSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<WebSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.Web;
    public override string DisplayName => "Web Search";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.WebSearchTopic, TimeRange: ResolveTimeRange(query), SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true, Country: options.DefaultCountry);
    private static string? ResolveTimeRange(ResearchSearchQuery query) => query.EndDate is not null ? "day" : query.StartDate is not null ? "week" : "week";
}

public sealed class NewsSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<NewsSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.News;
    public override string DisplayName => "News";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.NewsTopic, TimeRange: "day", SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}

public sealed class ArchiveSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<ArchiveSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.Archive;
    public override string DisplayName => "Archive";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.WebSearchTopic, TimeRange: "year", IncludeDomains: options.ArchiveDomains, SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}

public sealed class RedditSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<RedditSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.Reddit;
    public override string DisplayName => "Reddit";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.WebSearchTopic, TimeRange: "week", IncludeDomains: options.RedditDomains, SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}

public sealed class FinancialSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<FinancialSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.Financial;
    public override string DisplayName => "Financial Data";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.FinancialTopic, TimeRange: "month", IncludeDomains: options.FinancialDomains, SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}

public sealed class TwitterSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<TwitterSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.Twitter;
    public override string DisplayName => "Twitter X";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.WebSearchTopic, TimeRange: "day", IncludeDomains: options.TwitterDomains, SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}

public sealed class YouTubeSearchAdapter(TavilySearchProvider searchProvider, IOptions<ResearchSearchSourceOptions> options, ILogger<YouTubeSearchAdapter> logger)
    : TavilyResearchSearchSourceAdapter(searchProvider, options, logger)
{
    public override ResearchSearchSource Source => ResearchSearchSource.YouTube;
    public override string DisplayName => "YouTube";
    protected override SearchProviderSearchRequest BuildRequest(ResearchSearchQuery query, ResearchSearchSourceOptions options)
        => new(null, null, query.Query, query.MaxResults, Topic: options.WebSearchTopic, TimeRange: "week", IncludeDomains: options.YoutubeDomains, SearchDepth: "advanced", IncludeRawContent: true, AutoParameters: true);
}
