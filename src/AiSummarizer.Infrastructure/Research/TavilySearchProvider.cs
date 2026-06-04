using System.Net.Http.Json;
using System.Text.Json;
using AiSummarizer.Application.Research;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiSummarizer.Infrastructure.Research;

public sealed class TavilySearchProvider(HttpClient httpClient, IConfiguration configuration, ILogger<TavilySearchProvider> logger, ISearchProviderRepository? searchProviderRepository = null) : ISearchProvider
{
    public string ProviderName => "Tavily";

    public async Task<IReadOnlyList<SearchResult>> SearchAsync(Guid? jobId, Guid? searchProviderKeyId, string query, int maxResults, string? apiKey = null, CancellationToken cancellationToken = default)
    {
        var activeApiKey = apiKey ?? configuration["Tavily:ApiKey"];
        if (string.IsNullOrWhiteSpace(activeApiKey))
        {
            throw new InvalidOperationException("Tavily API key is missing. Set Tavily:ApiKey or provide it per request.");
        }

        var requestBody = new
        {
            api_key = activeApiKey,
            query = query,
            search_depth = "advanced",
            include_images = false,
            include_answer = false,
            max_results = maxResults
        };

        var response = await httpClient.PostAsJsonAsync("https://api.tavily.com/search", requestBody, cancellationToken);
        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

        logger.LogInformation("[Tavily] response received. StatusCode={StatusCode}, KeyId={KeyId}", response.StatusCode, searchProviderKeyId);

        if (searchProviderRepository is not null)
        {
            await searchProviderRepository.LogRequestAsync(ProviderName, searchProviderKeyId, jobId, JsonSerializer.Serialize(requestBody), (int)response.StatusCode, cancellationToken);
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
