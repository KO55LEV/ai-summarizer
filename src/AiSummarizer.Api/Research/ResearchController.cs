using AiSummarizer.Application.Research;
using AiSummarizer.Application.Workflows;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace AiSummarizer.Api.Research;

[ApiController]
[Route("api/research")]
public sealed class ResearchController(IResearchService researchService) : ControllerBase
{
    [HttpGet("search-sources")]
    public IActionResult GetSearchSources([FromServices] AiSummarizer.Application.Research.IResearchSearchSourceRegistry registry)
        => Ok(registry.List());

    [HttpGet]
    public async Task<ActionResult<ResearchListResponse>> GetList(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        if (requestedByUserId is null || requestedByUserId == Guid.Empty)
        {
            return BadRequest(new { message = "requestedByUserId is required." });
        }

        return Ok(Map(await researchService.GetResearchListAsync(requestedByUserId, limit, offset, cancellationToken)));
    }

    [HttpGet("{topicId:guid}")]
    public async Task<ActionResult<ResearchTopicResponse>> GetTopic([FromRoute] Guid topicId, [FromQuery] Guid? requestedByUserId, CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        return Ok(MapTopic(topic));
    }

    [HttpPost]
    public async Task<ActionResult<ResearchTopicResponse>> CreateTopic([FromBody] CreateResearchTopicRequest request, CancellationToken cancellationToken)
        => Ok(MapTopic(await researchService.CreateTopicAsync(new CreateResearchTopicCommand(
            request.RequestedByUserId,
            request.ProjectId,
            request.Name,
            request.Description,
            request.Frequency,
            string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status,
            request.DeliveryTime,
            request.Sources,
            request.Tags,
            request.Outputs), cancellationToken)));

    [HttpPut("{topicId:guid}")]
    public async Task<ActionResult<ResearchTopicResponse>> UpdateTopic([FromRoute] Guid topicId, [FromBody] UpdateResearchTopicRequest request, CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, request.RequestedByUserId))
        {
            return Forbid();
        }

        return Ok(MapTopic(await researchService.UpdateTopicAsync(topicId, new UpdateResearchTopicCommand(
            request.ProjectId,
            request.Name,
            request.Description,
            request.Frequency,
            request.Status,
            request.DeliveryTime,
            request.Sources,
            request.Tags,
            request.Outputs), cancellationToken)));
    }

    [HttpDelete("{topicId:guid}")]
    public async Task<IActionResult> DeleteTopic([FromRoute] Guid topicId, [FromQuery] Guid? requestedByUserId, CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        await researchService.DeleteTopicAsync(topicId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{topicId:guid}/briefing")]
    public async Task<ActionResult<ResearchBriefingResponse>> GetLatestBriefing([FromRoute] Guid topicId, [FromQuery] Guid? requestedByUserId, CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        return Ok(MapBriefing(await researchService.GetLatestBriefingAsync(topicId, cancellationToken)));
    }

    [HttpGet("{topicId:guid}/briefings")]
    public async Task<ActionResult<IReadOnlyList<ResearchBriefingHistoryItemResponse>>> ListBriefings(
        [FromRoute] Guid topicId,
        [FromQuery] Guid? requestedByUserId,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        return Ok((await researchService.ListBriefingHistoryAsync(topicId, limit, offset, cancellationToken)).Select(MapBriefingHistory).ToArray());
    }

    [HttpGet("{topicId:guid}/history")]
    public Task<ActionResult<IReadOnlyList<ResearchBriefingHistoryItemResponse>>> GetHistory(
        [FromRoute] Guid topicId,
        [FromQuery] Guid? requestedByUserId,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => ListBriefings(topicId, requestedByUserId, limit, offset, cancellationToken);

    [HttpGet("{topicId:guid}/briefings/{briefingId:guid}")]
    public async Task<ActionResult<ResearchBriefingResponse>> GetBriefing(
        [FromRoute] Guid topicId,
        [FromRoute] Guid briefingId,
        [FromQuery] Guid? requestedByUserId,
        CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        return Ok(MapBriefing(await researchService.GetBriefingAsync(topicId, briefingId, cancellationToken)));
    }

    [HttpPost("{topicId:guid}/briefings")]
    public async Task<ActionResult<ResearchBriefingResponse>> CreateBriefing(
        [FromRoute] Guid topicId,
        [FromBody] CreateResearchBriefingRequest request,
        CancellationToken cancellationToken)
        => Ok(MapBriefing(await researchService.CreateBriefingAsync(topicId, new CreateResearchBriefingCommand(
            request.RequestedByUserId,
            request.GeneratedAt ?? DateTimeOffset.UtcNow,
            request.PeriodLabel,
            request.ReadTimeMinutes,
            request.WordCount,
            request.Summary,
            request.PreviewText,
            request.NextRunAt,
            request.Sections.Select(section => new ResearchBriefingSectionInput(section.Title, section.Sentiment, section.Items)).ToArray(),
            request.Sources.Select(source => new ResearchBriefingSourceInput(source.Title, source.Domain)).ToArray()), cancellationToken)));

    [HttpGet("{topicId:guid}/runs")]
    public async Task<ActionResult<IReadOnlyList<ResearchTopicRunResponse>>> ListTopicRuns(
        [FromRoute] Guid topicId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] Guid? requestedByUserId,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        var runs = await researchRepository.ListTopicRunsAsync(topicId, limit, offset, cancellationToken);
        IReadOnlyList<ResearchTopicRunDto> activeJobRuns = offset == 0
            ? await researchRepository.ListActiveTopicRunJobsAsync(topicId, cancellationToken)
            : Array.Empty<ResearchTopicRunDto>();

        return Ok(activeJobRuns.Concat(runs).Select(MapRun).ToArray());
    }

    [HttpPost("{topicId:guid}/runs")]
    public async Task<ActionResult<StartResearchTopicRunResponse>> StartRun(
        [FromRoute] Guid topicId,
        [FromBody] StartResearchTopicRunRequest request,
        [FromServices] IWorkflowsRepository workflowsRepository,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
    {
        var topic = await researchService.GetTopicAsync(topicId, cancellationToken);
        var requestedByUserId = request.RequestedByUserId ?? topic.RequestedByUserId;
        if (!CanAccessTopic(topic, requestedByUserId))
        {
            return Forbid();
        }

        var activeRun = await researchRepository.GetActiveTopicRunAsync(topicId, cancellationToken);
        if (activeRun is not null)
        {
            return Ok(new StartResearchTopicRunResponse(
                activeRun.JobId,
                activeRun.WorkflowId,
                topicId,
                activeRun.Id,
                "research.topic.run",
                "already_running",
                activeRun.CreatedAt,
                "A research run is already queued or running for this topic."));
        }

        var activeWorkflow = await workflowsRepository.GetActiveWorkflowByInputGuidAsync("research.topic", "researchTopicId", topicId, cancellationToken);
        if (activeWorkflow is not null)
        {
            return Ok(new StartResearchTopicRunResponse(
                null,
                activeWorkflow.Id,
                topicId,
                null,
                "research.topic.run",
                "already_running",
                activeWorkflow.CreatedAt,
                "A research workflow is already queued or running for this topic."));
        }

        var workflowId = Guid.NewGuid();
        var triggeredBy = string.IsNullOrWhiteSpace(request.TriggeredBy) ? "api" : request.TriggeredBy.Trim();
        var now = DateTimeOffset.UtcNow;
        var workflow = await workflowsRepository.CreateWorkflowAsync(new Domain.Workflows.Workflow
        {
            Id = workflowId,
            RequestedByUserId = requestedByUserId,
            SourceId = null,
            WorkflowType = "research.topic",
            Status = "queued",
            Input = JsonSerializer.SerializeToElement(new
            {
                researchTopicId = topicId,
                topicName = topic.Name,
                requestedByUserId,
                triggeredBy,
                forceRun = request.ForceRun
            }),
            Result = null,
            CurrentStepKey = null,
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return Ok(new StartResearchTopicRunResponse(
            null,
            workflow.Id,
            topicId,
            null,
            "research.topic.run",
            "queued",
            workflow.CreatedAt,
            "Research workflow queued."));
    }

    [HttpGet("runs/{runId:guid}")]
    public async Task<ActionResult<ResearchTopicRunResponse>> GetRun(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
    {
        var run = await researchRepository.GetTopicRunByIdAsync(runId, cancellationToken);
        return run is null ? NotFound() : Ok(MapRun(run));
    }

    [HttpGet("runs/{runId:guid}/phases")]
    public async Task<ActionResult<IReadOnlyList<ResearchTopicRunPhaseResponse>>> ListRunPhases(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
        => Ok((await researchRepository.ListTopicRunPhasesAsync(runId, cancellationToken)).Select(MapRunPhase).ToArray());

    [HttpGet("runs/{runId:guid}/content")]
    public async Task<ActionResult<IReadOnlyList<ResearchContentItemResponse>>> ListRunContent(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] int limit = 200,
        [FromQuery] int offset = 0)
        => Ok((await researchRepository.ListContentItemsAsync(runId, limit, offset, cancellationToken)).Select(MapContentItem).ToArray());

    [HttpGet("runs/{runId:guid}/documents")]
    public async Task<ActionResult<IReadOnlyList<ResearchDocumentResponse>>> ListRunDocuments(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] int limit = 200,
        [FromQuery] int offset = 0)
        => Ok((await researchRepository.ListDocumentsAsync(runId, limit, offset, cancellationToken)).Select(MapDocument).ToArray());

    [HttpGet("runs/{runId:guid}/ranking-runs")]
    public async Task<ActionResult<IReadOnlyList<ResearchRankingRunResponse>>> ListRunRankingRuns(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
        => Ok((await researchRepository.ListRankingRunsAsync(runId, cancellationToken)).Select(MapRankingRun).ToArray());

    [HttpGet("runs/{runId:guid}/ranked-documents")]
    public async Task<ActionResult<IReadOnlyList<ResearchRankedDocumentResponse>>> ListRunRankedDocuments(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] int limit = 200,
        [FromQuery] int offset = 0)
        => Ok((await researchRepository.ListRankedDocumentsAsync(runId, limit, offset, cancellationToken)).Select(MapRankedDocument).ToArray());

    [HttpGet("runs/{runId:guid}/synthesis-runs")]
    public async Task<ActionResult<IReadOnlyList<ResearchSynthesisRunResponse>>> ListRunSynthesisRuns(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
        => Ok((await researchRepository.ListSynthesisRunsAsync(runId, limit, offset, cancellationToken)).Select(MapSynthesisRun).ToArray());

    [HttpGet("synthesis-runs/{synthesisRunId:guid}")]
    public async Task<ActionResult<ResearchSynthesisRunResponse>> GetSynthesisRun(
        [FromRoute] Guid synthesisRunId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
    {
        var synthesisRun = await researchRepository.GetSynthesisRunByIdAsync(synthesisRunId, cancellationToken);
        return synthesisRun is null ? NotFound() : Ok(MapSynthesisRun(synthesisRun));
    }

    [HttpGet("documents/{documentId:guid}/chunks")]
    public async Task<ActionResult<IReadOnlyList<ResearchDocumentChunkResponse>>> ListDocumentChunks(
        [FromRoute] Guid documentId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken)
        => Ok((await researchRepository.ListDocumentChunksAsync(documentId, cancellationToken)).Select(MapDocumentChunk).ToArray());

    [HttpGet("runs/{runId:guid}/search-results")]
    public async Task<ActionResult<IReadOnlyList<ResearchSearchResultResponse>>> ListRunSearchResults(
        [FromRoute] Guid runId,
        [FromServices] IResearchRepository researchRepository,
        CancellationToken cancellationToken,
        [FromQuery] int limit = 100,
        [FromQuery] int offset = 0)
        => Ok((await researchRepository.ListSearchResultsAsync(runId, limit, offset, cancellationToken)).Select(MapSearchResult).ToArray());

    private static ResearchListResponse Map(ResearchListDto list)
        => new(
            list.Topics.Select(MapTopic).ToArray(),
            new ResearchStatsResponse(
                list.Stats.ActiveTopics,
                list.Stats.BriefingsGenerated,
                list.Stats.SourcesTracked,
                list.Stats.AvgReadTimeMinutes));

    private static ResearchTopicResponse MapTopic(ResearchTopicDto topic)
        => new(
            topic.Id,
            topic.RequestedByUserId,
            topic.ProjectId,
            topic.Name,
            topic.Description,
            topic.Frequency,
            topic.Status,
            topic.DeliveryTime,
            topic.Sources,
            topic.Tags,
            topic.Outputs,
            topic.BriefingsCount,
            topic.LastRunAt,
            topic.NextRunAt,
            topic.LastBriefingPreview,
            topic.CreatedAt,
            topic.UpdatedAt);

    private static ResearchBriefingResponse MapBriefing(ResearchBriefingDto briefing)
        => new(
            briefing.Id,
            briefing.ResearchTopicId,
            briefing.RequestedByUserId,
            briefing.TopicName,
            briefing.GeneratedAt,
            briefing.PeriodLabel,
            briefing.ReadTimeMinutes,
            briefing.WordCount,
            briefing.Summary,
            briefing.Sections.Select(section => new ResearchBriefingSectionResponse(section.Title, section.Sentiment, section.Items)).ToArray(),
            briefing.Sources.Select(source => new ResearchBriefingSourceResponse(source.Title, source.Domain)).ToArray(),
            briefing.PastBriefings.Select(MapBriefingHistory).ToArray(),
            briefing.PreviewText);

    private static ResearchBriefingHistoryItemResponse MapBriefingHistory(ResearchBriefingHistoryItemDto item)
        => new(item.Id, item.GeneratedAt, item.PreviewText);

    private static ResearchTopicRunResponse MapRun(ResearchTopicRunDto run)
        => new(
            run.Id,
            run.ResearchTopicId,
            run.RequestedByUserId,
            run.JobId,
            run.WorkflowId,
            run.Status.ToString().ToLowerInvariant(),
            run.TriggeredBy,
            run.StartedAt,
            run.FinishedAt,
            run.NextRetryAt,
            run.ErrorCode,
            run.ErrorMessage,
            run.SummaryPreview,
            run.CreatedAt,
            run.UpdatedAt);

    private static bool CanAccessTopic(ResearchTopicDto topic, Guid? requestedByUserId)
        => requestedByUserId is not null
           && requestedByUserId != Guid.Empty
           && topic.RequestedByUserId == requestedByUserId;

    private static ResearchContentItemResponse MapContentItem(ResearchContentItemDto item)
        => new(
            item.Id,
            item.ResearchContentRunId,
            item.ResearchTopicRunId,
            item.ResearchTopicId,
            item.SourceKey,
            item.SourceUrl,
            item.CanonicalUrl,
            item.Title,
            item.AuthorName,
            item.PublishedAt,
            item.FetchMethod,
            item.ContentType,
            item.Status.ToString().ToLowerInvariant(),
            item.ContentHash,
            item.RawText,
            item.RawStoragePath,
            item.RawMetadataJson,
            item.ErrorCode,
            item.ErrorMessage,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchDocumentResponse MapDocument(ResearchDocumentDto item)
        => new(
            item.Id,
            item.ResearchContentItemId,
            item.ResearchTopicRunId,
            item.ResearchTopicId,
            item.SourceKey,
            item.CanonicalUrl,
            item.Title,
            item.AuthorName,
            item.PublishedAt,
            item.NormalizedAt,
            item.CanonicalBody,
            item.CanonicalHash,
            item.RawContentHash,
            item.SourceProvenanceJson,
            item.NormalizerVersion,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchDocumentChunkResponse MapDocumentChunk(ResearchDocumentChunkDto item)
        => new(
            item.Id,
            item.ResearchDocumentId,
            item.ChunkIndex,
            item.ChunkTitle,
            item.ChunkText,
            item.TokenCount,
            item.StartOffset,
            item.EndOffset,
            item.ChunkHash,
            item.ChunkMetadataJson,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchRankingRunResponse MapRankingRun(ResearchRankingRunDto item)
        => new(
            item.Id,
            item.ResearchTopicRunId,
            item.ResearchTopicRunPhaseId,
            item.ResearchTopicId,
            item.Status.ToString().ToLowerInvariant(),
            item.ScoringVersion,
            item.TotalDocuments,
            item.SelectedDocuments,
            item.StartedAt,
            item.FinishedAt,
            item.ErrorCode,
            item.ErrorMessage,
            item.MetricsJson,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchRankedDocumentResponse MapRankedDocument(ResearchRankedDocumentDto item)
        => new(
            item.Id,
            item.ResearchRankingRunId,
            item.ResearchTopicRunId,
            item.ResearchTopicId,
            item.ResearchDocumentId,
            item.SourceKey,
            item.Title,
            item.CanonicalUrl,
            item.Score,
            item.FreshnessScore,
            item.SourceWeight,
            item.LengthScore,
            item.RankPosition,
            item.IsSelected,
            item.ReasonJson,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchSynthesisRunResponse MapSynthesisRun(ResearchSynthesisRunDto item)
        => new(
            item.Id,
            item.ResearchTopicRunId,
            item.ResearchTopicRunPhaseId,
            item.ResearchTopicId,
            item.ResearchRankingRunId,
            item.Status.ToString().ToLowerInvariant(),
            item.ReasoningProvider,
            item.Model,
            item.PromptVersion,
            item.InputHash,
            item.RequestJson,
            item.ResponseJson,
            item.OutputJson,
            item.UsageJson,
            item.SelectedDocumentCount,
            item.StartedAt,
            item.FinishedAt,
            item.ErrorCode,
            item.ErrorMessage,
            item.ResearchBriefingId,
            item.CreatedAt,
            item.UpdatedAt);

    private static ResearchTopicRunPhaseResponse MapRunPhase(ResearchTopicRunPhaseDto phase)
        => new(
            phase.Id,
            phase.ResearchTopicRunId,
            phase.PhaseKey,
            phase.Status.ToString().ToLowerInvariant(),
            phase.AttemptCount,
            phase.StartedAt,
            phase.FinishedAt,
            phase.ErrorCode,
            phase.ErrorMessage,
            phase.MetricsJson,
            phase.CreatedAt,
            phase.UpdatedAt);

    private static ResearchSearchResultResponse MapSearchResult(ResearchSearchResultDto item)
        => new(
            item.Id,
            item.ResearchSearchRunId,
            item.ResearchTopicRunId,
            item.ResearchTopicId,
            item.SourceKey,
            item.Query,
            item.Title,
            item.Url,
            item.CanonicalUrl,
            item.Snippet,
            item.Score,
            item.PublishedAt,
            item.AuthorName,
            item.Domain,
            item.Language,
            item.ResultRank,
            item.RawResultJson,
            item.CreatedAt,
            item.UpdatedAt);
}
