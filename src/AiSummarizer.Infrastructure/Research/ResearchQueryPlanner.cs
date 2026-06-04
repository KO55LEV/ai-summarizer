using AiSummarizer.Application.Research;

namespace AiSummarizer.Infrastructure.Research;

public sealed class ResearchQueryPlanner : ISearchQueryPlanner
{
    public IReadOnlyList<ResearchSearchQuery> BuildQueries(string topic, IReadOnlyList<string> sourceKeys, string frequency)
    {
        var baseQuery = topic.Trim();
        var lookback = frequency.Trim().ToLowerInvariant() switch
        {
            "hourly" => TimeSpan.FromHours(2),
            "daily" => TimeSpan.FromDays(1),
            "weekly" => TimeSpan.FromDays(7),
            "monthly" => TimeSpan.FromDays(30),
            _ => TimeSpan.FromDays(7)
        };

        var end = DateTimeOffset.UtcNow;
        var start = end - lookback;

        return sourceKeys
            .SelectMany(sourceKey =>
            {
                var source = ParseSource(sourceKey);
                return source switch
                {
                    ResearchSearchSource.Web => new[] { new ResearchSearchQuery($"{baseQuery} latest", source, start, end, 10) },
                    ResearchSearchSource.News => new[] { new ResearchSearchQuery($"{baseQuery} news", source, start, end, 12) },
                    ResearchSearchSource.Archive => new[] { new ResearchSearchQuery($"{baseQuery} background history", source, start, end, 8) },
                    ResearchSearchSource.Reddit => new[] { new ResearchSearchQuery($"{baseQuery} reddit discussion", source, start, end, 10) },
                    ResearchSearchSource.Financial => new[] { new ResearchSearchQuery($"{baseQuery} market earnings", source, start, end, 8) },
                    ResearchSearchSource.Twitter => new[] { new ResearchSearchQuery($"{baseQuery} x twitter", source, start, end, 15) },
                    ResearchSearchSource.YouTube => new[] { new ResearchSearchQuery($"{baseQuery} youtube", source, start, end, 10) },
                    _ => Array.Empty<ResearchSearchQuery>()
                };
            })
            .ToArray();
    }

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
