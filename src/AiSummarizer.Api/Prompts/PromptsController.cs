using AiSummarizer.Application.Prompts;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Prompts;

[ApiController]
[Route("api/prompts")]
public sealed class PromptsController(IPromptsService promptsService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PromptResponse>> Create([FromBody] CreatePromptRequest request, CancellationToken cancellationToken)
        => Ok(Map(await promptsService.CreatePromptAsync(new CreatePromptCommand(
            request.PromptKey,
            request.Title,
            request.Description,
            request.WorkflowType,
            request.Provider,
            request.Model,
            request.SystemPrompt,
            request.UserPrompt,
            request.IsActive ?? true), cancellationToken)));

    [HttpGet("{promptId:guid}")]
    public async Task<ActionResult<PromptResponse>> GetById([FromRoute] Guid promptId, CancellationToken cancellationToken)
        => Ok(Map(await promptsService.GetPromptAsync(promptId, cancellationToken)));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PromptResponse>>> List([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await promptsService.ListPromptsAsync(limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpPut("{promptId:guid}")]
    public async Task<ActionResult<PromptResponse>> Update([FromRoute] Guid promptId, [FromBody] UpdatePromptRequest request, CancellationToken cancellationToken)
        => Ok(Map(await promptsService.UpdatePromptAsync(promptId, new UpdatePromptCommand(
            request.PromptKey,
            request.Title,
            request.Description,
            request.WorkflowType,
            request.Provider,
            request.Model,
            request.SystemPrompt,
            request.UserPrompt,
            request.IsActive), cancellationToken)));

    [HttpDelete("{promptId:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid promptId, CancellationToken cancellationToken)
    {
        await promptsService.DeletePromptAsync(promptId, cancellationToken);
        return NoContent();
    }

    private static PromptResponse Map(PromptDto prompt)
        => new(
            prompt.Id,
            prompt.PromptKey,
            prompt.Title,
            prompt.Description,
            prompt.WorkflowType,
            prompt.Provider,
            prompt.Model,
            prompt.SystemPrompt,
            prompt.UserPrompt,
            prompt.IsActive,
            prompt.CreatedAt,
            prompt.UpdatedAt);
}
