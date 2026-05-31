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

    [HttpGet("{promptId:guid}/archive")]
    public async Task<ActionResult<IReadOnlyList<PromptArchiveResponse>>> ListArchive([FromRoute] Guid promptId, [FromQuery] int limit = 100, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await promptsService.ListPromptArchivesAsync(promptId, limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("{promptId:guid}/runs")]
    public async Task<ActionResult<IReadOnlyList<PromptRunResponse>>> ListRuns([FromRoute] Guid promptId, [FromQuery] int limit = 100, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await promptsService.ListPromptRunsAsync(promptId, limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("{promptId:guid}/usage")]
    public async Task<ActionResult<PromptRunUsageResponse>> GetUsage([FromRoute] Guid promptId, CancellationToken cancellationToken)
        => Ok(Map(await promptsService.GetPromptRunUsageAsync(promptId, cancellationToken)));

    [HttpPost("{promptId:guid}/runs")]
    public async Task<ActionResult<PromptRunResponse>> RecordRun([FromRoute] Guid promptId, [FromBody] CreatePromptRunRequest request, CancellationToken cancellationToken)
        => Ok(Map(await promptsService.RecordPromptRunAsync(promptId, new CreatePromptRunCommand(
            request.WorkflowId,
            request.StepKey,
            request.Request,
            request.Response,
            request.Status,
            request.ErrorCode,
            request.ErrorMessage,
            request.InputTokens,
            request.OutputTokens,
            request.TotalTokens,
            request.DurationMs,
            request.StartedAt ?? DateTimeOffset.UtcNow,
            request.FinishedAt), cancellationToken)));

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

    private static PromptArchiveResponse Map(PromptArchiveDto archive)
        => new(
            archive.Id,
            archive.PromptId,
            archive.ArchiveVersion,
            archive.ArchiveReason,
            archive.PromptKey,
            archive.Title,
            archive.Description,
            archive.WorkflowType,
            archive.Provider,
            archive.Model,
            archive.SystemPrompt,
            archive.UserPrompt,
            archive.IsActive,
            archive.ArchivedAt,
            archive.SourceUpdatedAt);

    private static PromptRunResponse Map(PromptRunDto run)
        => new(
            run.Id,
            run.PromptId,
            run.WorkflowId,
            run.StepKey,
            run.PromptKey,
            run.Title,
            run.WorkflowType,
            run.Provider,
            run.Model,
            run.Request,
            run.Response,
            run.Status,
            run.ErrorCode,
            run.ErrorMessage,
            run.InputTokens,
            run.OutputTokens,
            run.TotalTokens,
            run.DurationMs,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt,
            run.UpdatedAt);

    private static PromptRunUsageResponse Map(PromptRunUsageDto usage)
        => new(
            usage.PromptId,
            usage.TotalRuns,
            usage.SucceededRuns,
            usage.FailedRuns,
            usage.RunningRuns,
            usage.LastRunAt,
            usage.LastStatus);
}
