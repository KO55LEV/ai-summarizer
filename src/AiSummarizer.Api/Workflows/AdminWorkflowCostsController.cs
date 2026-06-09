using AiSummarizer.Api.Users;
using AiSummarizer.Application.Users;
using AiSummarizer.Application.Workflows;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Workflows;

[ApiController]
[Route("api/admin/workflow-costs")]
public sealed class AdminWorkflowCostsController(IAdminWorkflowCostsService workflowCostsService, IUsersService usersService) : AdminAccessControllerBase(usersService)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkflowCostResponse>>> List([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok((await workflowCostsService.ListAsync(limit, offset, cancellationToken)).Select(Map).ToArray());
    }

    [HttpGet("{workflowId:guid}")]
    public async Task<ActionResult<WorkflowCostResponse>> Get([FromRoute] Guid workflowId, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await workflowCostsService.GetAsync(workflowId, cancellationToken)));
    }

    private static WorkflowCostResponse Map(WorkflowCostDto workflowCost)
        => new(
            workflowCost.WorkflowId,
            workflowCost.RequestedByUserId,
            workflowCost.RequestedByUserEmail,
            workflowCost.RequestedByUserDisplayName,
            workflowCost.WorkflowType,
            workflowCost.WorkflowStatus,
            workflowCost.SourceId,
            workflowCost.SourceLabel,
            workflowCost.ReservationId,
            workflowCost.ReservationStatus,
            workflowCost.EstimatedCredits,
            workflowCost.FinalCredits,
            workflowCost.SourceType,
            workflowCost.Reason,
            workflowCost.CreatedAt,
            workflowCost.StartedAt,
            workflowCost.FinishedAt,
            workflowCost.SettledAt,
            workflowCost.ReleasedAt);
}

public sealed record WorkflowCostResponse(
    Guid WorkflowId,
    Guid? RequestedByUserId,
    string? RequestedByUserEmail,
    string? RequestedByUserDisplayName,
    string WorkflowType,
    string WorkflowStatus,
    Guid? SourceId,
    string? SourceLabel,
    Guid? ReservationId,
    string? ReservationStatus,
    decimal EstimatedCredits,
    decimal? FinalCredits,
    string? SourceType,
    string? Reason,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? SettledAt,
    DateTimeOffset? ReleasedAt);
