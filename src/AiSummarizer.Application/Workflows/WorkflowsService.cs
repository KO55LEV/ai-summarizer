using System.Text.Json;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Workflows;

public sealed class WorkflowsService(
    IBillingService billingService,
    IMediaSourcesRepository mediaSourcesRepository,
    IUserVideoLibraryRepository userVideoLibraryRepository,
    IWorkflowsRepository repository) : IWorkflowsService
{
    public async Task<WorkflowDto> CreateYoutubeSummaryWorkflowAsync(CreateYoutubeSummaryWorkflowCommand command, CancellationToken cancellationToken)
    {
        var identity = MediaSourceIdentityParser.ParseYouTube(command.YoutubeUrl);
        var now = DateTimeOffset.UtcNow;
        var language = NormalizeNullable(command.Language);
        var mediaSource = await mediaSourcesRepository.UpsertMediaSourceAsync(new MediaSource
        {
            Id = Guid.NewGuid(),
            SourceProvider = identity.SourceProvider,
            SourceKind = identity.SourceKind,
            ExternalSourceId = identity.ExternalSourceId,
            CanonicalUrl = identity.CanonicalUrl,
            OriginalUrl = identity.OriginalUrl,
            DurationSeconds = null,
            NativeTranscriptAvailable = null,
            NativeTranscriptCheckedAt = null,
            NativeTranscriptLanguage = null,
            Metadata = JsonSerializer.SerializeToElement(new { }),
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        BillingReservationDto? reservation = null;
        try
        {
            var workflowId = Guid.NewGuid();
            if (command.RequestedByUserId is not null)
            {
                reservation = await billingService.ReserveAsync(
                    new ReserveBillingCreditsCommand(
                        command.RequestedByUserId.Value,
                        "youtube.summary",
                        workflowId,
                        BillingUsageEstimator.EstimateWorkflowCredits("youtube.summary"),
                        "Reserve credits for youtube summary workflow."),
                    cancellationToken);
            }

            var workflow = await repository.CreateWorkflowAsync(new Workflow
            {
                Id = workflowId,
                RequestedByUserId = command.RequestedByUserId,
                SourceId = mediaSource.Id,
                WorkflowType = "youtube.summary",
                Status = "queued",
                Input = JsonSerializer.SerializeToElement(new
                {
                    sourceId = mediaSource.Id,
                    sourceProvider = mediaSource.SourceProvider,
                    sourceKind = mediaSource.SourceKind,
                    sourceExternalId = mediaSource.ExternalSourceId,
                    language,
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

            if (command.RequestedByUserId is not null)
            {
                var nowCompleted = DateTimeOffset.UtcNow;
                _ = await userVideoLibraryRepository.UpsertUserVideoAsync(new UserVideoLibraryItem
                {
                    Id = Guid.NewGuid(),
                    RequestedByUserId = command.RequestedByUserId.Value,
                    MediaSourceId = mediaSource.Id,
                    PublicRequestRunId = null,
                    WorkflowId = workflow.Id,
                    TranscriptId = null,
                    Status = "queued",
                    SourceUrl = mediaSource.CanonicalUrl,
                    CompletedAt = null,
                    CreatedAt = nowCompleted,
                    UpdatedAt = nowCompleted
                }, null, cancellationToken);
            }

            return Map(workflow);
        }
        catch
        {
            if (reservation is not null)
            {
                try
                {
                    await billingService.ReleaseAsync(
                        new ReleaseBillingReservationCommand(reservation.Id, "Summary workflow creation failed."),
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

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
