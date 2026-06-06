using AiSummarizer.Application.Research;
using Microsoft.Extensions.DependencyInjection;

namespace AiSummarizer.Infrastructure.Research;

public sealed class ResearchSearchSourceRegistry(IServiceProvider serviceProvider) : IResearchSearchSourceRegistry
{
    public IResearchSearchSourceAdapter Get(ResearchSearchSource source) => source switch
    {
        ResearchSearchSource.Web => serviceProvider.GetRequiredService<WebSearchAdapter>(),
        ResearchSearchSource.News => serviceProvider.GetRequiredService<NewsSearchAdapter>(),
        ResearchSearchSource.Archive => serviceProvider.GetRequiredService<ArchiveSearchAdapter>(),
        ResearchSearchSource.Reddit => serviceProvider.GetRequiredService<RedditSearchAdapter>(),
        ResearchSearchSource.Financial => serviceProvider.GetRequiredService<FinancialSearchAdapter>(),
        ResearchSearchSource.Twitter => serviceProvider.GetRequiredService<TwitterSearchAdapter>(),
        ResearchSearchSource.YouTube => serviceProvider.GetRequiredService<YouTubeSearchAdapter>(),
        _ => throw new KeyNotFoundException($"No adapter registered for {source}.")
    };

    public IReadOnlyList<ResearchSearchSourceDescriptor> List() => new[]
    {
        new ResearchSearchSourceDescriptor(ResearchSearchSource.Web, "web", "Web Search", "General web discovery"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.News, "news", "News", "Recent news and updates"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.Archive, "archive", "Archive", "Archived and historical sources"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.Reddit, "reddit", "Reddit", "Community discussions"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.Financial, "financial", "Financial Data", "Market and earnings sources"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.Twitter, "twitter", "Twitter X", "X and Twitter posts"),
        new ResearchSearchSourceDescriptor(ResearchSearchSource.YouTube, "youtube", "YouTube", "Video discovery and commentary")
    };
}
