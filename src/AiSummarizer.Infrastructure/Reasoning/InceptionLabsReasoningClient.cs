using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Infrastructure.Reasoning.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Reasoning;

public sealed class InceptionLabsReasoningClient(HttpClient httpClient, IOptionsMonitor<InceptionLabsOptions> optionsMonitor, ILogger<InceptionLabsReasoningClient> logger) : IReasoningClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    public ReasoningProvider Provider => ReasoningProvider.InceptionLabs;
    public async Task<ReasoningResponse> CompleteAsync(ReasoningRequest request, CancellationToken cancellationToken = default)
    {
        var options = optionsMonitor.CurrentValue;
        if (string.IsNullOrWhiteSpace(options.ApiKey)) throw new ReasoningClientException(Provider, "Inception Labs API key is not configured.");
        var model = string.IsNullOrWhiteSpace(request.Model) ? options.DefaultModel : request.Model.Trim();
        var payload = new { model, temperature = request.Temperature, max_tokens = request.MaxTokens, messages = BuildMessages(request), response_format = string.Equals(request.ResponseFormat, "json", StringComparison.OrdinalIgnoreCase) ? new { type = "json_object" } : null };
        using var message = new HttpRequestMessage(HttpMethod.Post, $"{options.BaseUrl.TrimEnd('/')}/v1/chat/completions") { Content = JsonContent.Create(payload, options: JsonOptions) };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey.Trim());
        using var response = await httpClient.SendAsync(message, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode) throw new ReasoningClientException(Provider, $"Inception Labs request failed with status {(int)response.StatusCode}.");
        var completion = JsonSerializer.Deserialize<InceptionResponse>(raw, JsonOptions);
        var text = completion?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
        if (string.IsNullOrWhiteSpace(text)) throw new ReasoningClientException(Provider, "Inception Labs response did not include assistant content.");
        return new ReasoningResponse(Provider, completion?.Model ?? model, text, completion?.Choices?.FirstOrDefault()?.FinishReason, null, raw);
    }
    public Task<IEnumerable<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default) => Task.FromResult<IEnumerable<string>>(Array.Empty<string>());
    private static IReadOnlyList<object> BuildMessages(ReasoningRequest request) { if (request.Messages is { Count: > 0 }) return request.Messages.Select(m => new { role = m.Role switch { ReasoningMessageRole.System => "system", ReasoningMessageRole.Assistant => "assistant", _ => "user" }, content = m.Content }).Cast<object>().ToArray(); var messages = new List<object>(); if (!string.IsNullOrWhiteSpace(request.SystemPrompt)) messages.Add(new { role = "system", content = request.SystemPrompt.Trim() }); if (!string.IsNullOrWhiteSpace(request.UserPrompt)) messages.Add(new { role = "user", content = request.UserPrompt.Trim() }); if (messages.Count == 0) throw new ReasoningClientException(ReasoningProvider.InceptionLabs, "Reasoning request must contain at least one message."); return messages; }
    private sealed record InceptionResponse(string? Model, List<Choice>? Choices); private sealed record Choice(Message? Message, [property: JsonPropertyName("finish_reason")] string? FinishReason); private sealed record Message(string? Role, string? Content);
}
