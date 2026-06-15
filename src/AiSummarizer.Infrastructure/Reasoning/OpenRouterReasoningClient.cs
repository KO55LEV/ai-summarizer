using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Infrastructure.Reasoning.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Reasoning;

public sealed class OpenRouterReasoningClient(HttpClient httpClient, IOptionsMonitor<OpenRouterOptions> optionsMonitor, ILogger<OpenRouterReasoningClient> logger) : IReasoningClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    public ReasoningProvider Provider => ReasoningProvider.OpenRouter;
    public async Task<ReasoningResponse> CompleteAsync(ReasoningRequest request, CancellationToken cancellationToken = default)
    {
        var options = optionsMonitor.CurrentValue;
        if (string.IsNullOrWhiteSpace(options.ApiKey)) throw new ReasoningClientException(Provider, "OpenRouter API key is not configured.");
        var model = string.IsNullOrWhiteSpace(request.Model) ? options.DefaultModel : request.Model.Trim();
        var payload = BuildPayload(model, request);
        using var message = new HttpRequestMessage(HttpMethod.Post, $"{options.BaseUrl.TrimEnd('/')}/chat/completions") { Content = JsonContent.Create(payload) };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        message.Headers.Add("HTTP-Referer", "https://aisummarizer.local");
        message.Headers.Add("X-Title", "AiSummarizer");
        using var response = await httpClient.SendAsync(message, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "OpenRouter request failed with status {StatusCode}. Response body: {ResponseBody}",
                (int)response.StatusCode,
                string.IsNullOrWhiteSpace(raw) ? "<empty>" : raw);
            throw new ReasoningClientException(
                Provider,
                string.IsNullOrWhiteSpace(raw)
                    ? $"OpenRouter request failed with status {(int)response.StatusCode}."
                    : $"OpenRouter request failed with status {(int)response.StatusCode}: {Truncate(raw, 1000)}");
        }
        var completion = JsonSerializer.Deserialize<OpenRouterResponse>(raw, JsonOptions);
        var text = completion?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
        if (string.IsNullOrWhiteSpace(text)) throw new ReasoningClientException(Provider, "OpenRouter response did not include assistant content.");
        return new ReasoningResponse(Provider, completion?.Model ?? model, text, completion?.Choices?.FirstOrDefault()?.FinishReason, completion?.Usage is null ? null : new ReasoningUsage(completion.Usage.PromptTokens, completion.Usage.CompletionTokens, completion.Usage.TotalTokens), raw);
    }
    public Task<IEnumerable<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default) => Task.FromResult<IEnumerable<string>>(Array.Empty<string>());
    private static string Truncate(string value, int maxLength) => value.Length <= maxLength ? value : value[..maxLength];
    private static object BuildPayload(string model, ReasoningRequest request) => new { model, messages = BuildMessages(request).Select(x => new { role = x.Role switch { ReasoningMessageRole.System => "system", ReasoningMessageRole.Assistant => "assistant", _ => "user" }, content = x.Content }), response_format = string.Equals(request.ResponseFormat, "json", StringComparison.OrdinalIgnoreCase) ? new { type = "json_object" } : null };
    private static IReadOnlyList<ReasoningMessage> BuildMessages(ReasoningRequest request) { if (request.Messages is { Count: > 0 }) return request.Messages; var messages = new List<ReasoningMessage>(); if (!string.IsNullOrWhiteSpace(request.SystemPrompt)) messages.Add(new ReasoningMessage(ReasoningMessageRole.System, request.SystemPrompt.Trim())); if (!string.IsNullOrWhiteSpace(request.UserPrompt)) messages.Add(new ReasoningMessage(ReasoningMessageRole.User, request.UserPrompt.Trim())); if (messages.Count == 0) throw new ReasoningClientException(ReasoningProvider.OpenRouter, "Reasoning request must contain at least one message."); return messages; }
    private sealed record OpenRouterResponse(string? Model, List<Choice>? Choices, Usage? Usage); private sealed record Choice(Message? Message, [property: JsonPropertyName("finish_reason")] string? FinishReason); private sealed record Message(string? Role, string? Content); private sealed record Usage([property: JsonPropertyName("prompt_tokens")] int? PromptTokens, [property: JsonPropertyName("completion_tokens")] int? CompletionTokens, [property: JsonPropertyName("total_tokens")] int? TotalTokens);
}
