using AiSummarizer.Application.Research;

namespace AiSummarizer.Infrastructure.Research;

public sealed class ResearchQueryPlanner : ISearchQueryPlanner
{
    public IReadOnlyList<ResearchSearchQuery> BuildQueries(ResearchSearchPlan plan, string frequency)
    {
        var now = DateTimeOffset.UtcNow;
        var fallbackWindow = ResolveWindow(frequency);
        return plan.SourcePlans
            .SelectMany(sourcePlan =>
            {
                var source = ParseSource(sourcePlan.Source);
                if (sourcePlan.Queries.Count == 0)
                {
                    return Array.Empty<ResearchSearchQuery>();
                }

                var window = ResolveWindow(sourcePlan.Recency) ?? fallbackWindow;
                var start = now - window;
                var end = now;
                var maxResults = sourcePlan.MaxResults ?? ResolveDefaultMaxResults(source);
                return sourcePlan.Queries.Select(query => new ResearchSearchQuery(query, source, start, end, maxResults));
            })
            .ToArray();
    }

    private static TimeSpan? ResolveWindow(string? frequency)
        => frequency?.Trim().ToLowerInvariant() switch
        {
            "hour" or "hourly" => TimeSpan.FromHours(2),
            "day" or "daily" => TimeSpan.FromDays(1),
            "week" or "weekly" => TimeSpan.FromDays(7),
            "month" or "monthly" => TimeSpan.FromDays(30),
            null or "" => null,
            _ => null
        };

    private static int ResolveDefaultMaxResults(ResearchSearchSource source)
        => source switch
        {
            ResearchSearchSource.Web => 10,
            ResearchSearchSource.News => 12,
            ResearchSearchSource.Archive => 8,
            ResearchSearchSource.Reddit => 10,
            ResearchSearchSource.Financial => 8,
            ResearchSearchSource.Twitter => 15,
            ResearchSearchSource.YouTube => 10,
            _ => 10
        };

    private static ResearchSearchSource ParseSource(string raw)
        => Enum.TryParse<ResearchSearchSource>(raw, true, out var source)
            ? source
            : raw.Trim().ToLowerInvariant() switch
            {
                "web" or "web search" => ResearchSearchSource.Web,
                "news" => ResearchSearchSource.News,
                "archive" => ResearchSearchSource.Archive,
                "reddit" => ResearchSearchSource.Reddit,
                "financial" or "financial data" => ResearchSearchSource.Financial,
                "twitter" or "twitter x" or "x" => ResearchSearchSource.Twitter,
                "youtube" => ResearchSearchSource.YouTube,
                _ => ResearchSearchSource.Web
            };
}
