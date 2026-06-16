using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Workflows;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Workflows;

[ApiController]
[Route("api/workflows")]
public sealed class WorkflowsController(IWorkflowsService workflowsService) : ControllerBase
{
    [HttpPost("youtube-summary")]
    public async Task<ActionResult<WorkflowResponse>> CreateYoutubeSummary([FromBody] CreateYoutubeSummaryWorkflowRequest request, CancellationToken cancellationToken)
    {
        if (!IsYouTubeUrl(request.YoutubeUrl))
        {
            return BadRequest(new
            {
                status = StatusCodes.Status400BadRequest,
                detail = "YoutubeUrl must be a valid YouTube video URL."
            });
        }

        return Ok(Map(await workflowsService.CreateYoutubeSummaryWorkflowAsync(
            new CreateYoutubeSummaryWorkflowCommand(
                request.RequestedByUserId,
                request.YoutubeUrl,
                request.Language,
                request.PreferNativeTranscript ?? true),
            cancellationToken)));
    }

    [HttpGet("{workflowId:guid}")]
    public async Task<ActionResult<WorkflowResponse>> GetById([FromRoute] Guid workflowId, CancellationToken cancellationToken)
        => Ok(Map(await workflowsService.GetWorkflowAsync(workflowId, cancellationToken)));

    [HttpGet("active")]
    public async Task<ActionResult<IReadOnlyList<WorkflowResponse>>> GetActive([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await workflowsService.ListActiveWorkflowsAsync(limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<WorkflowResponse>>> GetHistory([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await workflowsService.ListHistoryWorkflowsAsync(limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("{workflowId:guid}/steps")]
    public async Task<ActionResult<IReadOnlyList<WorkflowStepResponse>>> GetSteps([FromRoute] Guid workflowId, CancellationToken cancellationToken)
        => Ok((await workflowsService.ListStepsAsync(workflowId, cancellationToken)).Select(Map).ToArray());

    [HttpGet("{workflowId:guid}/events")]
    public async Task<ActionResult<IReadOnlyList<WorkflowEventResponse>>> GetEvents([FromRoute] Guid workflowId, [FromQuery] int limit = 100, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await workflowsService.ListEventsAsync(workflowId, limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpPost("{workflowId:guid}/request-cancel")]
    public async Task<ActionResult<bool>> RequestCancel([FromRoute] Guid workflowId, CancellationToken cancellationToken)
        => Ok(await workflowsService.RequestCancelAsync(workflowId, cancellationToken));

    private static WorkflowResponse Map(WorkflowDto workflow)
        => new(
            workflow.Id,
            workflow.RequestedByUserId,
            workflow.SourceId,
            workflow.WorkflowType,
            workflow.Status,
            workflow.Input,
            workflow.Result,
            workflow.CurrentStepKey,
            workflow.ErrorCode,
            workflow.ErrorMessage,
            workflow.AttemptCount,
            workflow.MaxAttempts,
            workflow.AvailableAt,
            workflow.LockedBy,
            workflow.LockedAt,
            workflow.LockedUntil,
            workflow.StartedAt,
            workflow.FinishedAt,
            workflow.HeartbeatAt,
            workflow.ProgressPercent,
            workflow.ProgressMessage,
            workflow.CreatedAt,
            workflow.UpdatedAt);

    private static WorkflowStepResponse Map(WorkflowStepDto step)
        => new(
            step.Id,
            step.WorkflowId,
            step.StepOrder,
            step.StepKey,
            step.StepType,
            step.JobId,
            step.Status,
            step.Input,
            step.Output,
            step.ErrorCode,
            step.ErrorMessage,
            step.StartedAt,
            step.FinishedAt,
            step.CreatedAt,
            step.UpdatedAt);

    private static WorkflowEventResponse Map(WorkflowEventDto workflowEvent)
        => new(
            workflowEvent.Id,
            workflowEvent.WorkflowId,
            workflowEvent.StepKey,
            workflowEvent.Level,
            workflowEvent.Message,
            workflowEvent.Context,
            workflowEvent.CreatedAt);

    private static bool IsYouTubeUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            _ = MediaSourceIdentityParser.ParseYouTube(value);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
