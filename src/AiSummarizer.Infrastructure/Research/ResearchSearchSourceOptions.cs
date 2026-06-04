namespace AiSummarizer.Infrastructure.Research;

public sealed class ResearchSearchSourceOptions
{
    public string WebSearchTopic { get; set; } = "general";
    public string NewsTopic { get; set; } = "news";
    public string FinancialTopic { get; set; } = "finance";
    public string DefaultCountry { get; set; } = "united states";

    public IReadOnlyList<string> YoutubeDomains { get; set; } = new[] { "youtube.com", "youtu.be" };
    public IReadOnlyList<string> RedditDomains { get; set; } = new[] { "reddit.com", "www.reddit.com", "old.reddit.com" };
    public IReadOnlyList<string> FinancialDomains { get; set; } = new[] { "sec.gov", "investor.apple.com", "investor.nvidia.com", "finance.yahoo.com", "marketwatch.com", "bloomberg.com", "reuters.com" };
    public IReadOnlyList<string> TwitterDomains { get; set; } = new[] { "x.com", "twitter.com" };
    public IReadOnlyList<string> ArchiveDomains { get; set; } = new[] { "archive.org", "webcache.googleusercontent.com" };
}
