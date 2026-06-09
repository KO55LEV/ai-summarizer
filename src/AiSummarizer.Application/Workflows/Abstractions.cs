using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Workflows;

public interface IWorkflowsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IWorkflowsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Workflow> CreateWorkflowAsync(Workflow workflow, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Workflow?> GetWorkflowByIdAsync(Guid workflowId, CancellationToken cancellationToken);
    Task<Workflow?> GetActiveWorkflowBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken);
    Task<Workflow?> GetActiveWorkflowBySourceUrlAsync(string sourceUrl, CancellationToken cancellationToken);
    Task<IReadOnlyList<Workflow>> ListActiveWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<Workflow>> ListHistoryWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowStep>> ListStepsAsync(Guid workflowId, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowEvent>> ListEventsAsync(Guid workflowId, int limit, int offset, CancellationToken cancellationToken);
    Task<Workflow?> ClaimNextWorkflowAsync(string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken);
    Task<bool> HeartbeatWorkflowAsync(Guid workflowId, string workerId, short? progressPercent, string? progressMessage, TimeSpan leaseDuration, CancellationToken cancellationToken);
    Task<Workflow> UpdateWorkflowAsync(Workflow workflow, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<WorkflowStep> CreateWorkflowStepAsync(WorkflowStep step, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<WorkflowStep> UpdateWorkflowStepAsync(WorkflowStep step, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<WorkflowEvent> AddWorkflowEventAsync(Guid workflowId, string? stepKey, string level, string message, JsonElement context, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface IWorkflowsService
{
    Task<WorkflowDto> CreateYoutubeSummaryWorkflowAsync(CreateYoutubeSummaryWorkflowCommand command, CancellationToken cancellationToken);
    Task<WorkflowDto> GetWorkflowAsync(Guid workflowId, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowDto>> ListActiveWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowDto>> ListHistoryWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowStepDto>> ListStepsAsync(Guid workflowId, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowEventDto>> ListEventsAsync(Guid workflowId, int limit, int offset, CancellationToken cancellationToken);
}

public interface IAdminWorkflowCostsService
{
    Task<IReadOnlyList<WorkflowCostDto>> ListAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<WorkflowCostDto> GetAsync(Guid workflowId, CancellationToken cancellationToken);
}
