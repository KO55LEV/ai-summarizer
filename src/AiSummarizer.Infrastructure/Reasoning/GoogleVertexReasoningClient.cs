using Google.Cloud.AIPlatform.V1;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Infrastructure.Reasoning.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Reasoning;

public sealed class GoogleVertexReasoningClient(IOptionsMonitor<GoogleVertexReasoningOptions> optionsMonitor, ILogger<GoogleVertexReasoningClient> logger) : IReasoningClient
{
    public ReasoningProvider Provider => ReasoningProvider.GoogleVertex;
    public async Task<ReasoningResponse> CompleteAsync(ReasoningRequest request, CancellationToken cancellationToken = default)
    {
        var options = optionsMonitor.CurrentValue;
        if (string.IsNullOrWhiteSpace(options.ProjectId)) throw new ReasoningClientException(Provider, "Google Vertex Project ID is not configured.");
        var modelId = string.IsNullOrWhiteSpace(request.Model) ? options.DefaultModel : request.Model.Trim();
        var location = modelId.StartsWith("gemini-3", StringComparison.OrdinalIgnoreCase) ? "global" : (options.Location ?? "us-central1");
        var builder = new PredictionServiceClientBuilder { Endpoint = location == "global" ? "aiplatform.googleapis.com" : $"{location}-aiplatform.googleapis.com" };
        if (!string.IsNullOrWhiteSpace(options.CredentialsPath)) builder.CredentialsPath = options.CredentialsPath;
        var client = await builder.BuildAsync(cancellationToken);
        var req = new GenerateContentRequest { Model = $"projects/{options.ProjectId}/locations/{location}/publishers/google/models/{modelId}" };
        req.Contents.Add(new Content { Role = "user", Parts = { new Part { Text = request.UserPrompt ?? string.Empty } } });
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt)) req.SystemInstruction = new Content { Parts = { new Part { Text = request.SystemPrompt } } };
        var response = await client.GenerateContentAsync(req, cancellationToken: cancellationToken);
        var candidate = response.Candidates.FirstOrDefault();
        var text = candidate?.Content?.Parts?.FirstOrDefault()?.Text ?? string.Empty;
        return new ReasoningResponse(Provider, modelId, text, candidate?.FinishReason.ToString(), response.UsageMetadata is null ? null : new ReasoningUsage(response.UsageMetadata.PromptTokenCount, response.UsageMetadata.CandidatesTokenCount, response.UsageMetadata.TotalTokenCount), System.Text.Json.JsonSerializer.Serialize(response));
    }
    public Task<IEnumerable<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default) => Task.FromResult<IEnumerable<string>>(Array.Empty<string>());
}
