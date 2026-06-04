using AiSummarizer.Application.Research;
using Microsoft.AspNetCore.Mvc;

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
        => Ok(Map(await researchService.GetResearchListAsync(requestedByUserId, limit, offset, cancellationToken)));

    [HttpGet("{topicId:guid}")]
    public async Task<ActionResult<ResearchTopicResponse>> GetTopic([FromRoute] Guid topicId, CancellationToken cancellationToken)
        => Ok(MapTopic(await researchService.GetTopicAsync(topicId, cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<ResearchTopicResponse>> CreateTopic([FromBody] CreateResearchTopicRequest request, CancellationToken cancellationToken)
        => Ok(MapTopic(await researchService.CreateTopicAsync(new CreateResearchTopicCommand(
            request.RequestedByUserId,
            request.Name,
            request.Description,
            request.Frequency,
            request.DeliveryTime,
            request.Sources,
            request.Tags,
            request.Outputs), cancellationToken)));

    [HttpPut("{topicId:guid}")]
    public async Task<ActionResult<ResearchTopicResponse>> UpdateTopic([FromRoute] Guid topicId, [FromBody] UpdateResearchTopicRequest request, CancellationToken cancellationToken)
        => Ok(MapTopic(await researchService.UpdateTopicAsync(topicId, new UpdateResearchTopicCommand(
            request.Name,
            request.Description,
            request.Frequency,
            request.Status,
            request.DeliveryTime,
            request.Sources,
            request.Tags,
            request.Outputs), cancellationToken)));

    [HttpDelete("{topicId:guid}")]
    public async Task<IActionResult> DeleteTopic([FromRoute] Guid topicId, CancellationToken cancellationToken)
    {
        await researchService.DeleteTopicAsync(topicId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{topicId:guid}/briefing")]
    public async Task<ActionResult<ResearchBriefingResponse>> GetLatestBriefing([FromRoute] Guid topicId, CancellationToken cancellationToken)
        => Ok(MapBriefing(await researchService.GetLatestBriefingAsync(topicId, cancellationToken)));

    [HttpGet("{topicId:guid}/briefings")]
    public async Task<ActionResult<IReadOnlyList<ResearchBriefingHistoryItemResponse>>> ListBriefings(
        [FromRoute] Guid topicId,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => Ok((await researchService.ListBriefingHistoryAsync(topicId, limit, offset, cancellationToken)).Select(MapBriefingHistory).ToArray());

    [HttpGet("{topicId:guid}/history")]
    public Task<ActionResult<IReadOnlyList<ResearchBriefingHistoryItemResponse>>> GetHistory(
        [FromRoute] Guid topicId,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => ListBriefings(topicId, limit, offset, cancellationToken);

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
}
