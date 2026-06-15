using System.Text.Json;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Workflows;

public sealed class AdminWorkflowCostsService(
    IWorkflowsRepository workflowsRepository,
    IBillingRepository billingRepository,
    IUsersRepository usersRepository) : IAdminWorkflowCostsService
{
    public async Task<IReadOnlyList<WorkflowCostDto>> ListAsync(int limit, int offset, CancellationToken cancellationToken)
    {
        var workflows = await workflowsRepository.ListHistoryWorkflowsAsync(limit, offset, cancellationToken);
        var items = await Task.WhenAll(workflows.Select(workflow => MapAsync(workflow, cancellationToken)));
        return items;
    }

    public async Task<WorkflowCostDto> GetAsync(Guid workflowId, CancellationToken cancellationToken)
    {
        var workflow = await workflowsRepository.GetWorkflowByIdAsync(workflowId, cancellationToken)
            ?? throw new WorkflowNotFoundException("Workflow not found.");
        return await MapAsync(workflow, cancellationToken);
    }

    private async Task<WorkflowCostDto> MapAsync(Workflow workflow, CancellationToken cancellationToken)
    {
        AdminUserDto? user = null;
        if (workflow.RequestedByUserId is not null)
        {
            user = await usersRepository.GetAdminUserByIdAsync(workflow.RequestedByUserId.Value, null, cancellationToken);
        }

        BillingReservationDto? reservation = null;
        if (workflow.RequestedByUserId is not null)
        {
            reservation = await billingRepository.GetBillingReservationBySourceAsync(
                workflow.RequestedByUserId.Value,
                workflow.WorkflowType,
                workflow.Id,
                null,
                cancellationToken);

            if (reservation is null && workflow.SourceId is not null)
            {
                reservation = await billingRepository.GetBillingReservationBySourceAsync(
                    workflow.RequestedByUserId.Value,
                    workflow.WorkflowType,
                    workflow.SourceId.Value,
                    null,
                    cancellationToken);
            }
        }

        var latestErrorEvent = workflow.Status is "failed" or "dead" or "cancelled"
            ? (await workflowsRepository.ListEventsAsync(workflow.Id, 20, 0, cancellationToken))
                .FirstOrDefault(item => string.Equals(item.Level, "error", StringComparison.OrdinalIgnoreCase))
            : null;
        var diagnosticProvider = TryGetContextString(latestErrorEvent?.Context, "provider");
        var diagnosticMessage =
            TryGetContextString(latestErrorEvent?.Context, "providerMessage") ??
            TryGetContextString(latestErrorEvent?.Context, "exceptionMessage");

        return new WorkflowCostDto(
            workflow.Id,
            workflow.RequestedByUserId,
            user?.Email,
            user?.DisplayName,
            workflow.WorkflowType,
            workflow.Status,
            workflow.ErrorCode,
            workflow.ErrorMessage,
            diagnosticProvider,
            diagnosticMessage,
            workflow.SourceId,
            BuildSourceLabel(workflow),
            reservation?.Id,
            reservation?.Status,
            reservation?.EstimatedCredits ?? 0,
            reservation?.FinalCredits,
            reservation?.SourceType,
            reservation?.Reason,
            workflow.CreatedAt,
            workflow.StartedAt,
            workflow.FinishedAt,
            reservation?.SettledAt,
            reservation?.ReleasedAt);
    }

    private static string? BuildSourceLabel(Workflow workflow)
    {
        if (workflow.Input.ValueKind != JsonValueKind.Object)
        {
            return workflow.SourceId?.ToString();
        }

        if (TryGetString(workflow.Input, "sourceProvider", out var sourceProvider) &&
            TryGetString(workflow.Input, "sourceExternalId", out var externalId))
        {
            return string.IsNullOrWhiteSpace(sourceProvider) ? externalId : $"{sourceProvider} • {externalId}";
        }

        if (TryGetString(workflow.Input, "youtubeUrl", out var youtubeUrl))
        {
            return youtubeUrl;
        }

        if (TryGetString(workflow.Input, "sourceUrl", out var sourceUrl))
        {
            return sourceUrl;
        }

        return workflow.SourceId?.ToString();
    }

    private static bool TryGetString(JsonElement element, string propertyName, out string? value)
    {
        value = null;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString();
        return true;
    }

    private static string? TryGetContextString(JsonElement? element, string propertyName)
    {
        if (element is null ||
            element.Value.ValueKind != JsonValueKind.Object ||
            !element.Value.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return property.GetString();
    }
}
