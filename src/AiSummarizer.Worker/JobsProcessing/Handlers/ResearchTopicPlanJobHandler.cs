using System.Text.Json;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Logging;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicPlanJobHandler(
    IResearchRepository researchRepository,
    IResearchSearchPlanningService searchPlanningService,
    ILogger<ResearchTopicPlanJobHandler> logger) : IJobHandler
{
    public string JobType => "research.topic.plan";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic plan payload is missing researchTopicId.", null);
        }

        var topic = await researchRepository.GetTopicByIdAsync(payload.ResearchTopicId, cancellationToken);
        if (topic is null)
        {
            return JobHandlerResult.DeadLetter(
                "topic_not_found",
                $"Research topic {payload.ResearchTopicId} was not found.",
                JsonSerializer.SerializeToElement(new { researchTopicId = payload.ResearchTopicId }));
        }

        try
        {
            context.ReportProgress(5, "Planning search terms");
            var plan = await searchPlanningService.EnsureSearchPlanAsync(topic.Id, null, context.Job.Id, "research.plan", payload.ForceRefresh, cancellationToken);
            await context.LogInfoAsync("Research search plan generated", JsonSerializer.SerializeToElement(new
            {
                topicId = topic.Id,
                planVersion = plan.PlanVersion,
                promptKey = plan.PromptKey,
                provider = plan.Provider,
                model = plan.Model,
                status = plan.Status.ToString().ToLowerInvariant()
            }), cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                topicId = topic.Id,
                planVersion = plan.PlanVersion,
                promptKey = plan.PromptKey,
                provider = plan.Provider,
                model = plan.Model,
                status = plan.Status.ToString().ToLowerInvariant()
            }));
        }
        catch (ResearchSearchPlanningException ex)
        {
            logger.LogWarning(ex, "Research search plan generation failed for topic {TopicId}", topic.Id);
            await context.LogWarningAsync("Research search plan generation failed", JsonSerializer.SerializeToElement(new
            {
                topicId = topic.Id,
                errorCode = ex.ErrorCode,
                errorMessage = ex.Message
            }), cancellationToken);
            return JobHandlerResult.DeadLetter(ex.ErrorCode, ex.Message, JsonSerializer.SerializeToElement(new
            {
                topicId = topic.Id,
                errorCode = ex.ErrorCode,
                errorMessage = ex.Message
            }));
        }
    }

    private static StartResearchTopicPlanCommand? ParsePayload(JsonElement payload)
    {
        try
        {
            return payload.Deserialize<StartResearchTopicPlanCommand>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch
        {
            return null;
        }
    }
}
