using System.Text.Json;
using AiSummarizer.Application.Research;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.Workflows;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker;

public sealed class ResearchTopicSchedulerHostedService(
    IResearchRepository researchRepository,
    IWorkflowsRepository workflowsRepository,
    IOptions<ResearchSchedulerOptions> options,
    ILogger<ResearchTopicSchedulerHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollInterval = TimeSpan.FromSeconds(Math.Max(5, options.Value.PollIntervalSeconds));
        logger.LogInformation("Research topic scheduler started. Enabled={Enabled}, PollInterval={PollInterval}", options.Value.Enabled, pollInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (options.Value.Enabled)
                {
                    await RunOnceAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Research topic scheduler tick failed");
            }

            await Task.Delay(pollInterval, stoppingToken);
        }
    }

    public async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var dueTopics = await researchRepository.ListDueActiveTopicsAsync(now, Math.Max(1, options.Value.BatchSize), cancellationToken);

        if (dueTopics.Count == 0)
        {
            return;
        }

        logger.LogInformation("Research scheduler found {DueCount} due active topics", dueTopics.Count);

        foreach (var topic in dueTopics)
        {
            cancellationToken.ThrowIfCancellationRequested();

            Workflow? workflow = null;
            try
            {
                // This prevents duplicate runs in the normal single-worker deployment.
                // A database-level advisory lock or unique queued-run key is still needed
                // before running multiple scheduler instances concurrently.
                if (await researchRepository.HasActiveTopicRunAsync(topic.Id, cancellationToken))
                {
                    logger.LogInformation("Skipping scheduled research topic {TopicId}; an active run/job already exists", topic.Id);
                    continue;
                }
                if (await workflowsRepository.GetActiveWorkflowByInputGuidAsync("research.topic", "researchTopicId", topic.Id, cancellationToken) is not null)
                {
                    logger.LogInformation("Skipping scheduled research topic {TopicId}; an active workflow already exists", topic.Id);
                    continue;
                }

                var workflowId = Guid.NewGuid();
                workflow = await workflowsRepository.CreateWorkflowAsync(new Workflow
                {
                    Id = workflowId,
                    RequestedByUserId = topic.RequestedByUserId,
                    SourceId = null,
                    WorkflowType = "research.topic",
                    Status = "queued",
                    Input = JsonSerializer.SerializeToElement(new
                    {
                        researchTopicId = topic.Id,
                        topicName = topic.Name,
                        requestedByUserId = topic.RequestedByUserId,
                        triggeredBy = "scheduled",
                        forceRun = false
                    }),
                    Result = null,
                    CurrentStepKey = null,
                    AttemptCount = 0,
                    MaxAttempts = 3,
                    AvailableAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                }, null, cancellationToken);

                var nextRunAt = CalculateNextRunAt(topic.Frequency, now, topic.DeliveryTime);
                await researchRepository.UpdateTopicNextRunAtAsync(topic.Id, nextRunAt, null, cancellationToken);

                logger.LogInformation(
                    "Queued scheduled research workflow. TopicId={TopicId}, WorkflowId={WorkflowId}, NextRunAt={NextRunAt}",
                    topic.Id,
                    workflow.Id,
                    nextRunAt);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to schedule due research topic {TopicId}", topic.Id);

                if (workflow is not null)
                {
                    try
                    {
                        await workflowsRepository.UpdateWorkflowAsync(workflow with
                        {
                            Status = "failed",
                            ErrorCode = "workflow_queue_failed",
                            ErrorMessage = ex.Message,
                            FinishedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        }, null, cancellationToken);
                    }
                    catch
                    {
                        // Best effort only.
                    }
                }
            }
        }
    }

    private static DateTimeOffset CalculateNextRunAt(string frequency, DateTimeOffset from, TimeOnly? deliveryTime)
    {
        if (frequency == "hourly")
        {
            var nextHour = from.UtcDateTime.AddHours(1);
            return new DateTimeOffset(new DateTime(nextHour.Year, nextHour.Month, nextHour.Day, nextHour.Hour, 0, 0, DateTimeKind.Utc), TimeSpan.Zero);
        }

        var next = frequency switch
        {
            "weekly" => from.AddDays(7),
            "monthly" => from.AddMonths(1),
            _ => from.AddDays(1)
        };

        if (deliveryTime is null)
        {
            return next;
        }

        return new DateTimeOffset(next.UtcDateTime.Date.Add(deliveryTime.Value.ToTimeSpan()), TimeSpan.Zero);
    }
}
