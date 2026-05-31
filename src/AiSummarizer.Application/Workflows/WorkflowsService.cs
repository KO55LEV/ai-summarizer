using System.Text.Json;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Workflows;

public sealed class WorkflowsService(IWorkflowsRepository repository) : IWorkflowsService
{
    public async Task<WorkflowDto> CreateYoutubeSummaryWorkflowAsync(CreateYoutubeSummaryWorkflowCommand command, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var workflow = await repository.CreateWorkflowAsync(new Workflow
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = command.RequestedByUserId,
            WorkflowType = "youtube.summary",
            Status = "queued",
            Input = JsonSerializer.SerializeToElement(new
            {
                youtubeUrl = command.YoutubeUrl.Trim(),
                language = string.IsNullOrWhiteSpace(command.Language) ? "en" : command.Language.Trim(),
                preferNativeTranscript = command.PreferNativeTranscript
            }),
            Result = null,
            CurrentStepKey = null,
            AttemptCount = 0,
            MaxAttempts = 5,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return Map(workflow);
    }

    public async Task<WorkflowDto> GetWorkflowAsync(Guid workflowId, CancellationToken cancellationToken)
        => Map(await repository.GetWorkflowByIdAsync(workflowId, cancellationToken) ?? throw new WorkflowNotFoundException("Workflow not found."));

    public async Task<IReadOnlyList<WorkflowDto>> ListActiveWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListActiveWorkflowsAsync(limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<WorkflowDto>> ListHistoryWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListHistoryWorkflowsAsync(limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<WorkflowStepDto>> ListStepsAsync(Guid workflowId, CancellationToken cancellationToken)
        => (await repository.ListStepsAsync(workflowId, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<WorkflowEventDto>> ListEventsAsync(Guid workflowId, int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListEventsAsync(workflowId, limit, offset, cancellationToken)).Select(Map).ToArray();

    private static WorkflowDto Map(Workflow workflow)
        => new(
            workflow.Id,
            workflow.RequestedByUserId,
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

    private static WorkflowStepDto Map(WorkflowStep step)
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

    private static WorkflowEventDto Map(WorkflowEvent workflowEvent)
        => new(
            workflowEvent.Id,
            workflowEvent.WorkflowId,
            workflowEvent.StepKey,
            workflowEvent.Level,
            workflowEvent.Message,
            workflowEvent.Context,
            workflowEvent.CreatedAt);
}
