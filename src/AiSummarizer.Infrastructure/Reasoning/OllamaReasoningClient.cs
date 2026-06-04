using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Infrastructure.Reasoning.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Reasoning;

public sealed class OllamaReasoningClient(HttpClient httpClient, IOptionsMonitor<OllamaOptions> optionsMonitor, ILogger<OllamaReasoningClient> logger) : IReasoningClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    public ReasoningProvider Provider => ReasoningProvider.Ollama;
    public async Task<ReasoningResponse> CompleteAsync(ReasoningRequest request, CancellationToken cancellationToken = default)
    {
        var options = optionsMonitor.CurrentValue;
        var model = string.IsNullOrWhiteSpace(request.Model) ? options.DefaultModel : request.Model.Trim();
        if (string.IsNullOrWhiteSpace(model)) throw new ReasoningClientException(Provider, "Ollama model is not configured.");
        var payload = new { model, prompt = BuildPrompt(request), system = request.SystemPrompt?.Trim(), stream = false, format = string.Equals(request.ResponseFormat, "json", StringComparison.OrdinalIgnoreCase) ? "json" : null, options = new { temperature = request.Temperature ?? options.DefaultTemperature, num_predict = request.MaxTokens, num_ctx = options.DefaultContextWindow } };
        using var response = await httpClient.PostAsJsonAsync($"{options.BaseUrl.TrimEnd('/')}/api/generate", payload, JsonOptions, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode) throw new ReasoningClientException(Provider, $"Ollama request failed with status {(int)response.StatusCode}.");
        var completion = JsonSerializer.Deserialize<OllamaResponse>(raw, JsonOptions);
        if (string.IsNullOrWhiteSpace(completion?.Response)) throw new ReasoningClientException(Provider, "Ollama response did not include text.");
        return new ReasoningResponse(Provider, model, completion.Response.Trim(), completion.DoneReason, null, raw);
    }
    public async Task<IEnumerable<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default) => Array.Empty<string>();
    private static string BuildPrompt(ReasoningRequest request) { if (request.Messages is { Count: > 0 }) return string.Join($"{Environment.NewLine}{Environment.NewLine}", request.Messages.Select(m => $"{m.Role}: {m.Content.Trim()}")); if (!string.IsNullOrWhiteSpace(request.UserPrompt)) return request.UserPrompt.Trim(); throw new ReasoningClientException(ReasoningProvider.Ollama, "Reasoning request must contain a user prompt or messages."); }
    private sealed record OllamaResponse([property: JsonPropertyName("response")] string? Response, [property: JsonPropertyName("done_reason")] string? DoneReason);
}
