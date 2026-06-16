using System.Text.Json;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

internal static class ResearchWorkflowProgress
{
    public static async Task<WorkflowStep?> StartStepAsync(
        IWorkflowsRepository workflowsRepository,
        Guid? workflowId,
        int stepOrder,
        string stepKey,
        string stepType,
        Guid jobId,
        JsonElement input,
        CancellationToken cancellationToken)
    {
        if (workflowId is null)
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var workflow = await workflowsRepository.GetWorkflowByIdAsync(workflowId.Value, cancellationToken);
        if (workflow is null)
        {
            return null;
        }
        if (workflow.Status is "cancelled" or "dead")
        {
            return null;
        }

        await workflowsRepository.UpdateWorkflowAsync(workflow with
        {
            Status = "running",
            CurrentStepKey = stepKey,
            ProgressMessage = stepKey,
            StartedAt = workflow.StartedAt ?? now,
            UpdatedAt = now
        }, null, cancellationToken);

        var existingStep = (await workflowsRepository.ListStepsAsync(workflowId.Value, cancellationToken))
            .FirstOrDefault(step => string.Equals(step.StepKey, stepKey, StringComparison.OrdinalIgnoreCase));

        var step = existingStep is not null
            ? await workflowsRepository.UpdateWorkflowStepAsync(existingStep with
            {
                StepOrder = stepOrder,
                StepType = stepType,
                JobId = jobId,
                Status = "running",
                Input = input,
                Output = null,
                ErrorCode = null,
                ErrorMessage = null,
                StartedAt = now,
                FinishedAt = null,
                UpdatedAt = now
            }, null, cancellationToken)
            : await workflowsRepository.CreateWorkflowStepAsync(new WorkflowStep
            {
                Id = Guid.NewGuid(),
                WorkflowId = workflowId.Value,
                StepOrder = stepOrder,
                StepKey = stepKey,
                StepType = stepType,
                JobId = jobId,
                Status = "running",
                Input = input,
                Output = null,
                ErrorCode = null,
                ErrorMessage = null,
                StartedAt = now,
                FinishedAt = null,
                CreatedAt = now,
                UpdatedAt = now
            }, null, cancellationToken);

        await workflowsRepository.AddWorkflowEventAsync(
            workflowId.Value,
            stepKey,
            "info",
            $"Research step {stepKey} started.",
            input,
            null,
            cancellationToken);

        return step;
    }

    public static async Task CompleteStepAsync(
        IWorkflowsRepository workflowsRepository,
        WorkflowStep? step,
        JsonElement output,
        CancellationToken cancellationToken)
    {
        if (step is null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await workflowsRepository.UpdateWorkflowStepAsync(step with
        {
            Status = "succeeded",
            Output = output,
            FinishedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        await workflowsRepository.AddWorkflowEventAsync(
            step.WorkflowId,
            step.StepKey,
            "info",
            $"Research step {step.StepKey} completed.",
            output,
            null,
            cancellationToken);

        var workflow = await workflowsRepository.GetWorkflowByIdAsync(step.WorkflowId, cancellationToken);
        if (workflow is not null)
        {
            if (workflow.Status is "cancelled" or "dead")
            {
                return;
            }

            await workflowsRepository.UpdateWorkflowAsync(workflow with
            {
                CurrentStepKey = step.StepKey,
                ProgressMessage = $"{step.StepKey} completed",
                UpdatedAt = now
            }, null, cancellationToken);
        }
    }

    public static async Task FailStepAsync(
        IWorkflowsRepository workflowsRepository,
        WorkflowStep? step,
        string errorCode,
        string errorMessage,
        JsonElement context,
        CancellationToken cancellationToken)
    {
        if (step is null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await workflowsRepository.UpdateWorkflowStepAsync(step with
        {
            Status = "failed",
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            Output = context,
            FinishedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        await workflowsRepository.AddWorkflowEventAsync(
            step.WorkflowId,
            step.StepKey,
            "error",
            errorMessage,
            context,
            null,
            cancellationToken);

        var workflow = await workflowsRepository.GetWorkflowByIdAsync(step.WorkflowId, cancellationToken);
        if (workflow is not null)
        {
            if (workflow.Status is "cancelled" or "dead")
            {
                return;
            }

            await workflowsRepository.UpdateWorkflowAsync(workflow with
            {
                Status = "failed",
                CurrentStepKey = step.StepKey,
                ErrorCode = errorCode,
                ErrorMessage = errorMessage,
                FinishedAt = now,
                UpdatedAt = now
            }, null, cancellationToken);
        }
    }

    public static Task AddEventAsync(
        IWorkflowsRepository workflowsRepository,
        Guid? workflowId,
        string? stepKey,
        string level,
        string message,
        JsonElement context,
        CancellationToken cancellationToken)
    {
        if (workflowId is null)
        {
            return Task.CompletedTask;
        }

        return workflowsRepository.AddWorkflowEventAsync(workflowId.Value, stepKey, level, message, context, null, cancellationToken);
    }
}
