using System.Text.Json;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Transcripts;

public sealed class TranscriptInsightsService(
    IBillingService billingService,
    IMediaSourcesRepository mediaSourcesRepository,
    ITranscriptsRepository transcriptsRepository,
    IWorkflowsRepository workflowsRepository) : ITranscriptInsightsService
{
    public async Task<TranscriptInsightScheduleResultDto> CreateInsightWorkflowAsync(CreateTranscriptInsightWorkflowCommand command, CancellationToken cancellationToken)
    {
        var actionKey = NormalizeKey(command.ActionKey);
        var config = ResolveAction(actionKey);
        var now = DateTimeOffset.UtcNow;

        var transcript = await transcriptsRepository.GetTranscriptBySourceIdAsync(command.SourceId, cancellationToken);
        if (transcript is null)
        {
            var source = await mediaSourcesRepository.GetMediaSourceByIdAsync(command.SourceId, cancellationToken);
            if (source is null)
            {
                throw new ArgumentException("Transcript source not found.", nameof(command.SourceId));
            }

            transcript = await transcriptsRepository.GetTranscriptBySourceUrlAsync(source.CanonicalUrl, cancellationToken)
                ?? await transcriptsRepository.GetTranscriptBySourceUrlAsync(source.OriginalUrl, cancellationToken);
        }

        if (transcript is null)
        {
            throw new ArgumentException("Transcript not found for the supplied source.", nameof(command.SourceId));
        }

        var sourceId = transcript.SourceId ?? command.SourceId;
        var existingWorkflow = await workflowsRepository.GetActiveWorkflowBySourceIdAndTypeAsync(sourceId, config.WorkflowType, cancellationToken);
        if (existingWorkflow is not null)
        {
            return new TranscriptInsightScheduleResultDto(
                existingWorkflow.Status,
                actionKey,
                config.PromptKey,
                config.EstimatedCredits,
                Map(existingWorkflow),
                existingWorkflow.Result);
        }

        BillingReservationDto? reservation = null;
        try
        {
            if (command.RequestedByUserId is not null)
            {
                reservation = await billingService.ReserveAsync(
                    new ReserveBillingCreditsCommand(
                        command.RequestedByUserId.Value,
                        config.WorkflowType,
                        sourceId,
                        config.EstimatedCredits,
                        $"Reserve credits for {config.WorkflowType} workflow."),
                    cancellationToken);
            }

            var workflow = await workflowsRepository.CreateWorkflowAsync(new Workflow
            {
                Id = Guid.NewGuid(),
                RequestedByUserId = command.RequestedByUserId,
                SourceId = sourceId,
                WorkflowType = config.WorkflowType,
                Status = "queued",
                Input = JsonSerializer.SerializeToElement(new
                {
                    sourceId,
                    transcriptId = transcript.Id,
                    actionKey,
                    promptKey = config.PromptKey,
                    question = NormalizeNullable(command.Question),
                    conversationContext = NormalizeNullable(command.ConversationContext)
                }),
                Result = null,
                CurrentStepKey = null,
                AttemptCount = 0,
                MaxAttempts = 3,
                AvailableAt = now,
                CreatedAt = now,
                UpdatedAt = now
            }, null, cancellationToken);

            return new TranscriptInsightScheduleResultDto(
                "queued",
                actionKey,
                config.PromptKey,
                config.EstimatedCredits,
                Map(workflow),
                null);
        }
        catch
        {
            if (reservation is not null)
            {
                try
                {
                    await billingService.ReleaseAsync(
                        new ReleaseBillingReservationCommand(reservation.Id, "Insight workflow creation failed."),
                        cancellationToken);
                }
                catch
                {
                    // Best effort rollback only.
                }
            }

            throw;
        }
    }

    public async Task<IReadOnlyList<WorkflowDto>> ListInsightWorkflowsAsync(Guid sourceId, int limit, int offset, CancellationToken cancellationToken)
        => (await workflowsRepository.ListInsightWorkflowsBySourceIdAsync(sourceId, limit, offset, cancellationToken))
            .Select(Map)
            .ToArray();

    private static InsightWorkflowConfig ResolveAction(string actionKey)
        => actionKey switch
        {
            "quick-summary" => new("youtube.summary.quick_summary", "youtube.summary.quick_summary", BillingUsageEstimator.EstimateWorkflowCredits("youtube.summary.quick_summary")),
            "key-takeaways" => new("youtube.summary.key_takeaways", "youtube.summary.key_takeaways", BillingUsageEstimator.EstimateWorkflowCredits("youtube.summary.key_takeaways")),
            "ask-this-video" => new("youtube.summary.ask_this_video", "youtube.summary.ask_this_video", BillingUsageEstimator.EstimateWorkflowCredits("youtube.summary.ask_this_video")),
            "study-guide" => new("youtube.summary.study_guide", "youtube.summary.study_guide", BillingUsageEstimator.EstimateWorkflowCredits("youtube.summary.study_guide")),
            _ => throw new ArgumentException($"Unsupported insight action: {actionKey}", nameof(actionKey))
        };

    private static WorkflowDto Map(Workflow workflow)
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

    private static string NormalizeKey(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            throw new ArgumentException("ActionKey is required.", nameof(value));
        }

        return normalized;
    }

    private static string? NormalizeNullable(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private sealed record InsightWorkflowConfig(string WorkflowType, string PromptKey, decimal EstimatedCredits);
}
