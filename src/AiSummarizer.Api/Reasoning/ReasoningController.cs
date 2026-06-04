using AiSummarizer.Application.Reasoning;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Reasoning;

[ApiController]
[Route("api/reasoning")]
public sealed class ReasoningController(IReasoningClientFactory clientFactory) : ControllerBase
{
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ReasoningChatRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ReasoningProvider>(request.Provider, true, out var provider))
        {
            return BadRequest(new { message = $"Unsupported provider: {request.Provider}" });
        }

        var client = clientFactory.GetClient(provider);
        var response = await client.CompleteAsync(new ReasoningRequest(request.Model, request.SystemPrompt, request.UserPrompt, request.Messages?.Select(m => new ReasoningMessage(Enum.Parse<ReasoningMessageRole>(m.Role, true), m.Content)).ToArray(), request.Temperature, request.MaxTokens, request.ResponseFormat), cancellationToken);
        return Ok(response);
    }

    [HttpGet("providers")]
    public IActionResult Providers() => Ok(Enum.GetNames<ReasoningProvider>());
}

public sealed record ReasoningChatRequest(
    string Provider,
    string? Model,
    string? SystemPrompt,
    string? UserPrompt,
    IReadOnlyList<ReasoningChatMessage>? Messages,
    double? Temperature,
    int? MaxTokens,
    string? ResponseFormat);

public sealed record ReasoningChatMessage(string Role, string Content);
