using System.Net.Http.Json;
using System.Text.Json;
using AiSummarizer.Application.Research;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiSummarizer.Infrastructure.Research;

public sealed class TavilySearchProvider(HttpClient httpClient, IConfiguration configuration, ILogger<TavilySearchProvider> logger, ISearchProviderRepository? searchProviderRepository = null) : ISearchProvider
{
    public string ProviderName => "Tavily";

    public async Task<IReadOnlyList<SearchResult>> SearchAsync(SearchProviderSearchRequest request, CancellationToken cancellationToken = default)
    {
        var activeApiKey = request.ApiKey ?? configuration["Tavily:ApiKey"];
        if (string.IsNullOrWhiteSpace(activeApiKey))
        {
            throw new InvalidOperationException("Tavily API key is missing. Set Tavily:ApiKey or provide it per request.");
        }

        var requestBody = new
        {
            api_key = activeApiKey,
            query = request.Query,
            topic = request.Topic,
            time_range = request.TimeRange,
            start_date = request.StartDate?.ToString("yyyy-MM-dd"),
            end_date = request.EndDate?.ToString("yyyy-MM-dd"),
            search_depth = request.SearchDepth,
            include_domains = request.IncludeDomains,
            exclude_domains = request.ExcludeDomains,
            include_images = request.IncludeImages,
            include_image_descriptions = request.IncludeImageDescriptions,
            include_answer = request.IncludeAnswer,
            include_raw_content = request.IncludeRawContent,
            include_favicon = request.IncludeFavicon,
            country = request.Country,
            auto_parameters = request.AutoParameters,
            max_results = request.MaxResults
        };

        var response = await httpClient.PostAsJsonAsync("https://api.tavily.com/search", requestBody, cancellationToken);
        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

        logger.LogInformation("[Tavily] response received. StatusCode={StatusCode}, KeyId={KeyId}", response.StatusCode, request.SearchProviderKeyId);

        if (searchProviderRepository is not null)
        {
            await searchProviderRepository.LogRequestAsync(ProviderName, request.SearchProviderKeyId, request.JobId, JsonSerializer.Serialize(requestBody), (int)response.StatusCode, cancellationToken);
        }

        response.EnsureSuccessStatusCode();

        var resultData = JsonSerializer.Deserialize<TavilyResponse>(responseContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (resultData?.Results is null)
        {
            return Array.Empty<SearchResult>();
        }

        return resultData.Results
            .Select(result => new SearchResult(
                result.Url ?? string.Empty,
                result.Title ?? string.Empty,
                result.Content ?? string.Empty,
                JsonSerializer.Serialize(result)))
            .ToArray();
    }

    private sealed class TavilyResponse
    {
        public List<TavilyResult>? Results { get; set; }
    }

    private sealed class TavilyResult
    {
        public string? Title { get; set; }
        public string? Url { get; set; }
        public string? Content { get; set; }
        public float Score { get; set; }
    }
}
