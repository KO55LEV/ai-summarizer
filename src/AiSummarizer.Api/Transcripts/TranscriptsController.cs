using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.PublicRequests;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.PublicRequests;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace AiSummarizer.Api.Transcripts;

[ApiController]
[Route("api/transcripts")]
public sealed class TranscriptsController(
    ITranscriptSchedulingService transcriptSchedulingService,
    ITranscriptsRepository transcriptsRepository,
    IMediaSourcesRepository mediaSourcesRepository,
    IPublicRequestRunsRepository publicRequestRunsRepository,
    ILogger<TranscriptsController> logger) : ControllerBase
{
    [HttpPost("youtube/schedule")]
    public async Task<ActionResult<TranscriptScheduleResponse>> ScheduleYoutubeTranscript([FromBody] ScheduleYoutubeTranscriptRequest request, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var requestRun = await publicRequestRunsRepository.CreatePublicRequestRunAsync(new PublicRequestRun
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = request.RequestedByUserId,
            ApiArea = "public",
            OperationName = nameof(ScheduleYoutubeTranscript),
            HttpMethod = HttpContext.Request.Method,
            RequestPath = HttpContext.Request.Path.Value ?? "/api/transcripts/youtube/schedule",
            SourceUrl = request.YoutubeUrl,
            Request = JsonSerializer.SerializeToElement(request),
            Status = "running",
            StartedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        MediaSourceIdentity? identity = null;
        if (IsYouTubeUrl(request.YoutubeUrl))
        {
            identity = MediaSourceIdentityParser.ParseYouTube(request.YoutubeUrl);
        }
        else
        {
            var errorResponse = new
            {
                status = StatusCodes.Status400BadRequest,
                detail = "YoutubeUrl must be a valid YouTube video URL.",
                requestId = requestRun.Id
            };
            await SafeUpdateRequestRunAsync(requestRun with
            {
                Status = "failed",
                ErrorCode = "invalid_input",
                ErrorMessage = "YoutubeUrl must be a valid YouTube video URL.",
                Response = JsonSerializer.SerializeToElement(errorResponse),
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });

            return BadRequest(errorResponse);
        }

        try
        {
            var result = await transcriptSchedulingService.ScheduleYoutubeTranscriptAsync(
                new ScheduleYoutubeTranscriptCommand(
                    request.RequestedByUserId,
                    request.YoutubeUrl,
                    request.Language,
                    request.PreferNativeTranscript ?? true),
                cancellationToken);

            var response = Map(requestRun.Id, result);
            await SafeUpdateRequestRunAsync(requestRun with
            {
                SourceId = result.Transcript?.SourceId ?? result.Workflow?.SourceId,
                SourceProvider = identity?.SourceProvider,
                SourceKind = identity?.SourceKind,
                ExternalSourceId = identity?.ExternalSourceId,
                SourceUrl = identity?.CanonicalUrl,
                WorkflowId = result.Workflow?.Id,
                TranscriptId = result.Transcript?.Id,
                Response = JsonSerializer.SerializeToElement(response),
                Status = "succeeded",
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });

            return string.Equals(result.Status, "completed", StringComparison.OrdinalIgnoreCase)
                ? Ok(response)
                : Accepted(response);
        }
        catch (Exception ex)
        {
            await SafeUpdateRequestRunAsync(requestRun with
            {
                SourceProvider = identity?.SourceProvider,
                SourceKind = identity?.SourceKind,
                ExternalSourceId = identity?.ExternalSourceId,
                SourceUrl = identity?.CanonicalUrl,
                ErrorCode = ex.GetType().Name,
                ErrorMessage = ex.Message,
                Status = "failed",
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            throw;
        }
    }

    private static TranscriptScheduleResponse Map(Guid requestId, TranscriptScheduleResultDto result)
        => new(
            requestId,
            result.Status,
            result.Transcript is null ? null : Map(result.Transcript),
            result.Workflow is null ? null : Map(result.Workflow));

    private async Task SafeUpdateRequestRunAsync(PublicRequestRun requestRun)
    {
        try
        {
            await publicRequestRunsRepository.UpdatePublicRequestRunAsync(requestRun, null, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to update public request run {RequestRunId}", requestRun.Id);
        }
    }

    private static TranscriptSummaryResponse Map(TranscriptSummaryDto transcript)
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

    [HttpGet("requests/{requestId:guid}")]
    public async Task<ActionResult<PublicRequestRunResponse>> GetRequestRun([FromRoute] Guid requestId, CancellationToken cancellationToken)
    {
        var requestRun = await publicRequestRunsRepository.GetPublicRequestRunByIdAsync(requestId, cancellationToken);
        return requestRun is null ? NotFound() : Ok(Map(requestRun));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<TranscriptHistoryItemResponse>>> GetHistory([FromQuery] Guid? requestedByUserId = null, [FromQuery] int limit = 20, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
    {
        var requestRuns = await publicRequestRunsRepository.ListPublicRequestRunsAsync(requestedByUserId, nameof(ScheduleYoutubeTranscript), limit, offset, cancellationToken);
        return Ok(requestRuns.Select(MapHistory).ToArray());
    }

    [HttpGet("source/{sourceId:guid}")]
    public async Task<ActionResult<TranscriptSummaryResponse>> GetBySourceId([FromRoute] Guid sourceId, CancellationToken cancellationToken)
    {
        var transcript = await transcriptsRepository.GetTranscriptBySourceIdAsync(sourceId, cancellationToken);
        if (transcript is null)
        {
            var source = await mediaSourcesRepository.GetMediaSourceByIdAsync(sourceId, cancellationToken);
            if (source is null)
            {
                return NotFound();
            }

            transcript = await transcriptsRepository.GetTranscriptBySourceUrlAsync(source.CanonicalUrl, cancellationToken)
                ?? await transcriptsRepository.GetTranscriptBySourceUrlAsync(source.OriginalUrl, cancellationToken);
            if (transcript is null)
            {
                return NotFound();
            }
        }

        return Ok(Map(transcript));
    }

    private static AiSummarizer.Api.Workflows.WorkflowResponse Map(WorkflowDto workflow)
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

    private static PublicRequestRunResponse Map(PublicRequestRun run)
        => new(
            run.Id,
            run.RequestedByUserId,
            run.ApiArea,
            run.OperationName,
            run.HttpMethod,
            run.RequestPath,
            run.SourceId,
            run.SourceProvider,
            run.SourceKind,
            run.ExternalSourceId,
            run.SourceUrl,
            run.WorkflowId,
            run.TranscriptId,
            run.Request,
            run.Response,
            run.Status,
            run.ErrorCode,
            run.ErrorMessage,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt,
            run.UpdatedAt);

    private static TranscriptHistoryItemResponse MapHistory(PublicRequestRun run)
        => new(
            run.Id,
            run.SourceId,
            run.SourceProvider,
            run.SourceKind,
            run.ExternalSourceId,
            run.SourceUrl,
            run.WorkflowId,
            run.TranscriptId,
            run.Status,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt);

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
