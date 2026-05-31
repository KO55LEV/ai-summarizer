using System.Text.Json;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Transcripts;

public sealed class TranscriptSchedulingService(
    IMediaSourcesRepository mediaSourcesRepository,
    ITranscriptsRepository transcriptsRepository,
    IWorkflowsRepository workflowsRepository) : ITranscriptSchedulingService
{
    public async Task<TranscriptScheduleResultDto> ScheduleYoutubeTranscriptAsync(ScheduleYoutubeTranscriptCommand command, CancellationToken cancellationToken)
    {
        var identity = MediaSourceIdentityParser.ParseYouTube(command.YoutubeUrl);
        var language = NormalizeNullable(command.Language) ?? "en";
        var now = DateTimeOffset.UtcNow;

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

        var existingTranscript = await FindExistingTranscriptAsync(mediaSource, cancellationToken);
        if (existingTranscript is not null)
        {
            return new TranscriptScheduleResultDto("completed", Map(existingTranscript), null);
        }

        var activeWorkflow = await FindActiveWorkflowAsync(mediaSource, cancellationToken);
        if (activeWorkflow is not null)
        {
            return new TranscriptScheduleResultDto("queued", null, Map(activeWorkflow));
        }

        var workflow = await workflowsRepository.CreateWorkflowAsync(new Workflow
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = command.RequestedByUserId,
            SourceId = mediaSource.Id,
            WorkflowType = "youtube.transcript",
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

        return new TranscriptScheduleResultDto("queued", null, Map(workflow));
    }

    private static TranscriptSummaryDto Map(Transcript transcript)
        => new(
            transcript.Id,
            transcript.JobId,
            transcript.SourceId,
            transcript.SourceJobId,
            transcript.SourceUrl,
            transcript.SourceFilePath,
            transcript.TranscriptFilePath,
            transcript.Language,
            transcript.LanguageProbability,
            transcript.DurationSeconds,
            transcript.SegmentCount,
            transcript.WordCount,
            transcript.CharacterCount,
            transcript.TranscriptText,
            transcript.CreatedAt,
            transcript.UpdatedAt);

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

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private async Task<Transcript?> FindExistingTranscriptAsync(MediaSource mediaSource, CancellationToken cancellationToken)
    {
        var transcript = await transcriptsRepository.GetTranscriptBySourceIdAsync(mediaSource.Id, cancellationToken);
        if (transcript is not null)
        {
            return transcript;
        }

        return await transcriptsRepository.GetTranscriptBySourceUrlAsync(mediaSource.CanonicalUrl, cancellationToken)
            ?? await transcriptsRepository.GetTranscriptBySourceUrlAsync(mediaSource.OriginalUrl, cancellationToken);
    }

    private async Task<Workflow?> FindActiveWorkflowAsync(MediaSource mediaSource, CancellationToken cancellationToken)
    {
        var workflow = await workflowsRepository.GetActiveWorkflowBySourceIdAsync(mediaSource.Id, cancellationToken);
        if (workflow is not null)
        {
            return workflow;
        }

        return await workflowsRepository.GetActiveWorkflowBySourceUrlAsync(mediaSource.CanonicalUrl, cancellationToken)
            ?? await workflowsRepository.GetActiveWorkflowBySourceUrlAsync(mediaSource.OriginalUrl, cancellationToken);
    }
}
