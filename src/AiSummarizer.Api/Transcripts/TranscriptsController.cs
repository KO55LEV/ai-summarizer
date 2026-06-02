using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.PublicRequests;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Transcripts;
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

    private static TranscriptSummaryResponse Map(Transcript transcript)
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
            transcript.TranscriptText,
            transcript.CreatedAt,
            transcript.UpdatedAt);

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
            transcript.CleanText,
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
    {
        var displayStatus = DeriveDisplayStatus(run);
        var sourceLabel = DeriveSourceLabel(run);
        var language = DeriveLanguage(run);
        var durationSeconds = DeriveDurationSeconds(run);

        return new(
            run.Id,
            run.SourceId,
            run.SourceProvider,
            run.SourceKind,
            run.ExternalSourceId,
            run.SourceUrl,
            run.WorkflowId,
            run.TranscriptId,
            run.Status,
            displayStatus,
            sourceLabel,
            language,
            durationSeconds,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt);
    }

    private static string DeriveDisplayStatus(PublicRequestRun run)
    {
        var transcript = TryGetTranscript(run.Response);
        if (transcript is not null)
        {
            return "completed";
        }

        var workflow = TryGetWorkflow(run.Response);
        if (workflow is not null)
        {
            var workflowStatus = GetStringProperty(workflow.Value, "status");
            return NormalizeStatus(workflowStatus);
        }

        return NormalizeStatus(run.Status);
    }

    private static string? DeriveSourceLabel(PublicRequestRun run)
    {
        var transcript = TryGetTranscript(run.Response);
        if (transcript is not null)
        {
            var sourceFilePath = GetStringProperty(transcript.Value, "sourceFilePath");
            return string.IsNullOrWhiteSpace(sourceFilePath) ? "YouTube captions" : "Whisper";
        }

        var workflow = TryGetWorkflow(run.Response);
        if (workflow is not null)
        {
            var workflowStatus = GetStringProperty(workflow.Value, "status");
            return NormalizeStatus(workflowStatus) switch
            {
                "completed" => "YouTube captions",
                "running" => "Processing",
                "queued" => "Queued",
                "failed" => "Failed",
                "cancelled" => "Cancelled",
                _ => "Queued"
            };
        }

        return null;
    }

    private static string? DeriveLanguage(PublicRequestRun run)
    {
        var transcript = TryGetTranscript(run.Response);
        if (transcript is not null)
        {
            var language = GetStringProperty(transcript.Value, "language");
            if (!string.IsNullOrWhiteSpace(language))
            {
                return language;
            }
        }

        var requestLanguage = GetStringProperty(run.Request, "language");
        return string.IsNullOrWhiteSpace(requestLanguage) ? null : requestLanguage;
    }

    private static decimal? DeriveDurationSeconds(PublicRequestRun run)
    {
        var transcript = TryGetTranscript(run.Response);
        if (transcript is null)
        {
            return null;
        }

        return GetDecimalProperty(transcript.Value, "durationSeconds");
    }

    private static string NormalizeStatus(string? value)
        => value?.Trim().ToLowerInvariant() switch
        {
            "running" => "running",
            "queued" => "queued",
            "failed" => "failed",
            "cancelled" => "cancelled",
            "succeeded" => "completed",
            "completed" => "completed",
            _ => "unknown"
        };

    private static JsonElement? TryGetTranscript(JsonElement? response)
    {
        if (response is not { ValueKind: JsonValueKind.Object } responseObject)
        {
            return null;
        }

        return responseObject.TryGetProperty("transcript", out var transcript) && transcript.ValueKind == JsonValueKind.Object
            ? transcript
            : null;
    }

    private static JsonElement? TryGetWorkflow(JsonElement? response)
    {
        if (response is not { ValueKind: JsonValueKind.Object } responseObject)
        {
            return null;
        }

        return responseObject.TryGetProperty("workflow", out var workflow) && workflow.ValueKind == JsonValueKind.Object
            ? workflow
            : null;
    }

    private static string? GetStringProperty(JsonElement element, string propertyName)
        => element.TryGetProperty(propertyName, out var property) && property.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            ? property.GetString()
            : null;

    private static decimal? GetDecimalProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetDecimal(out var value) => value,
            JsonValueKind.String when decimal.TryParse(property.GetString(), out var parsed) => parsed,
            _ => null
        };
    }

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
