using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicRunJobHandler(
    IResearchRepository researchRepository,
    ISearchQueryPlanner searchQueryPlanner,
    IResearchSearchSourceRegistry searchSourceRegistry,
    IJobsRepository jobsRepository,
    ILogger<ResearchTopicRunJobHandler> logger) : IJobHandler
{
    public string JobType => "research.topic.run";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic run payload is missing researchTopicId.", null);
        }

        var topic = await researchRepository.GetTopicByIdAsync(payload.ResearchTopicId, cancellationToken);
        if (topic is null)
        {
            return JobHandlerResult.DeadLetter(
                "topic_not_found",
                $"Research topic {payload.ResearchTopicId} was not found.",
                JsonSerializer.SerializeToElement(new { researchTopicId = payload.ResearchTopicId }));
        }

        if (topic.Sources.Count == 0)
        {
            return JobHandlerResult.DeadLetter(
                "topic_has_no_sources",
                "Research topic has no sources configured.",
                JsonSerializer.SerializeToElement(new { researchTopicId = topic.Id }));
        }

        var now = DateTimeOffset.UtcNow;
        var runId = Guid.NewGuid();
        var phaseId = Guid.NewGuid();
        var plannerVersion = "v1";

        await context.LogInfoAsync("Research topic run started", JsonSerializer.SerializeToElement(new
        {
            runId,
            topicId = topic.Id,
            topicName = topic.Name,
            sourceCount = topic.Sources.Count,
            frequency = topic.Frequency,
            triggeredBy = payload.TriggeredBy,
            forceRun = payload.ForceRun
        }), cancellationToken);

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateTopicRunAsync(new ResearchTopicRunRecord(
                runId,
                topic.Id,
                payload.RequestedByUserId ?? topic.RequestedByUserId,
                context.Job.Id,
                ResearchTopicRunStatus.Running,
                payload.TriggeredBy,
                now,
                null,
                null,
                null,
                null,
                null,
                now,
                now), transaction, cancellationToken);

            await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                runId,
                "search_intake",
                ResearchTopicRunPhaseStatus.Running,
                1,
                now,
                null,
                null,
                null,
                JsonSerializer.Serialize(new { plannerVersion, forceRun = payload.ForceRun }),
                now,
                now), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        context.ReportProgress(10, "Planning research queries");

        var topicSeed = string.Join(" ", new[] { topic.Name, topic.Description ?? string.Empty }.Where(value => !string.IsNullOrWhiteSpace(value)));
        var queries = searchQueryPlanner.BuildQueries(topicSeed, topic.Sources, topic.Frequency);
        var groupedQueries = queries.GroupBy(query => query.Source).ToArray();

        await context.LogInfoAsync("Research queries planned", JsonSerializer.SerializeToElement(new
        {
            runId,
            topicId = topic.Id,
            plannerVersion,
            queryCount = queries.Count,
            sources = groupedQueries.Select(group => new
            {
                source = group.Key.ToString().ToLowerInvariant(),
                queryCount = group.Count(),
                queries = group.Select(query => new
                {
                    query = query.Query,
                    maxResults = query.MaxResults,
                    startDate = query.StartDate,
                    endDate = query.EndDate
                })
            })
        }), cancellationToken);

        var totalResults = 0;
        var failedSources = 0;
        var failedSourceNames = new List<string>();

        foreach (var sourceGroup in groupedQueries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var adapter = searchSourceRegistry.Get(sourceGroup.Key);
            var searchRunId = Guid.NewGuid();
            var searchRunNow = DateTimeOffset.UtcNow;
            var sourceKey = sourceGroup.Key.ToString().ToLowerInvariant();
            var sourceQueries = sourceGroup.ToArray();

            await context.LogInfoAsync("Research source search started", JsonSerializer.SerializeToElement(new
            {
                runId,
                topicId = topic.Id,
                searchRunId,
                source = sourceKey,
                adapter = adapter.DisplayName,
                queryCount = sourceQueries.Length,
                queries = sourceQueries.Select(query => new
                {
                    query = query.Query,
                    maxResults = query.MaxResults,
                    startDate = query.StartDate,
                    endDate = query.EndDate
                })
            }), cancellationToken);

            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.CreateSearchRunAsync(new ResearchSearchRunRecord(
                    searchRunId,
                    runId,
                    phaseId,
                    topic.Id,
                    sourceKey,
                    plannerVersion,
                    sourceQueries.Length,
                    ResearchSearchRunStatus.Running,
                    searchRunNow,
                    null,
                    null,
                    null,
                    "{}",
                    searchRunNow,
                    searchRunNow), transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            try
            {
                var combinedResults = new List<ResearchSearchResult>();
                foreach (var query in sourceQueries)
                {
                    var results = await adapter.SearchAsync(query, cancellationToken);
                    combinedResults.AddRange(results);
                    await context.LogInfoAsync("Research search query completed", JsonSerializer.SerializeToElement(new
                    {
                        runId,
                        topicId = topic.Id,
                        searchRunId,
                        source = sourceKey,
                        query = query.Query,
                        resultCount = results.Count,
                        topResults = results.Take(5).Select(result => new
                        {
                            title = result.Title,
                            url = result.Url,
                            score = result.Score
                        })
                    }), cancellationToken);
                }

                var uniqueResults = combinedResults
                    .GroupBy(result => NormalizeUrl(result.Url), StringComparer.OrdinalIgnoreCase)
                    .Select(group => group
                        .OrderByDescending(item => item.Score)
                        .First())
                    .OrderByDescending(item => item.Score)
                    .ToArray();

                await context.LogInfoAsync("Research source search finished", JsonSerializer.SerializeToElement(new
                {
                    runId,
                    topicId = topic.Id,
                    searchRunId,
                    source = sourceKey,
                    adapter = adapter.DisplayName,
                    queryCount = sourceQueries.Length,
                    combinedResultCount = combinedResults.Count,
                    uniqueResultCount = uniqueResults.Length,
                    topResults = uniqueResults.Take(10).Select(result => new
                    {
                        query = result.Query,
                        title = result.Title,
                        url = result.Url,
                        score = result.Score,
                        domain = TryGetDomain(result.Url)
                    })
                }), cancellationToken);

                await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
                {
                    var completedRun = new ResearchSearchRunRecord(
                        searchRunId,
                        runId,
                        phaseId,
                        topic.Id,
                        sourceKey,
                        plannerVersion,
                        sourceQueries.Length,
                        ResearchSearchRunStatus.Succeeded,
                        searchRunNow,
                        DateTimeOffset.UtcNow,
                        null,
                        null,
                        JsonSerializer.Serialize(new
                        {
                            queryCount = sourceQueries.Length,
                            resultCount = uniqueResults.Length,
                            source = sourceKey
                        }),
                        searchRunNow,
                        DateTimeOffset.UtcNow);

                    await repository.UpdateSearchRunAsync(completedRun, transaction, cancellationToken);

                    var rank = 0;
                    foreach (var result in uniqueResults)
                    {
                        await repository.CreateSearchResultAsync(new ResearchSearchResultRecord(
                            Guid.NewGuid(),
                            searchRunId,
                            runId,
                            topic.Id,
                            sourceKey,
                            result.Query,
                            result.Title,
                            result.Url,
                            NormalizeUrl(result.Url),
                            Truncate(result.Content, 2000),
                            result.Score,
                            null,
                            TryGetDomain(result.Url),
                            null,
                            null,
                            rank++,
                            SerializeRawResult(result),
                            DateTimeOffset.UtcNow,
                            DateTimeOffset.UtcNow), transaction, cancellationToken);
                    }

                    return 0;
                }, cancellationToken);

                totalResults += uniqueResults.Length;
            }
            catch (Exception ex)
            {
                failedSources++;
                failedSourceNames.Add(sourceKey);
                logger.LogWarning(ex, "Research source {Source} failed during search intake", sourceKey);
                await context.LogWarningAsync("Research source search failed", JsonSerializer.SerializeToElement(new
                {
                    runId,
                    topicId = topic.Id,
                    searchRunId,
                    source = sourceKey,
                    adapter = adapter.DisplayName,
                    queryCount = sourceQueries.Length,
                    error = ex.Message,
                    exception = ex.GetType().FullName
                }), cancellationToken);

                await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
                {
                    await repository.UpdateSearchRunAsync(new ResearchSearchRunRecord(
                        searchRunId,
                        runId,
                        phaseId,
                        topic.Id,
                        sourceKey,
                        plannerVersion,
                        sourceQueries.Length,
                        ResearchSearchRunStatus.Failed,
                        searchRunNow,
                        DateTimeOffset.UtcNow,
                        "search_failed",
                        ex.Message,
                        JsonSerializer.Serialize(new
                        {
                            queryCount = sourceQueries.Length,
                            source = sourceKey,
                            exception = ex.GetType().FullName
                        }),
                        searchRunNow,
                        DateTimeOffset.UtcNow), transaction, cancellationToken);
                    return 0;
                }, cancellationToken);
            }
        }

        var phaseStatus = totalResults > 0
            ? ResearchTopicRunPhaseStatus.Succeeded
            : ResearchTopicRunPhaseStatus.Failed;

        var runStatus = phaseStatus == ResearchTopicRunPhaseStatus.Succeeded
            ? ResearchTopicRunStatus.Running
            : ResearchTopicRunStatus.Failed;

        var phaseFinishedAt = DateTimeOffset.UtcNow;
        var runFinishedAt = phaseStatus == ResearchTopicRunPhaseStatus.Succeeded ? (DateTimeOffset?)null : phaseFinishedAt;
        var updatedAt = DateTimeOffset.UtcNow;
        var summaryPreview = totalResults > 0
            ? $"Research search intake completed with {totalResults} results."
            : "Research search intake found no results.";

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                runId,
                "search_intake",
                phaseStatus,
                1,
                now,
                phaseFinishedAt,
                phaseStatus == ResearchTopicRunPhaseStatus.Failed ? "search_failed" : null,
                phaseStatus == ResearchTopicRunPhaseStatus.Failed ? "Search intake returned no results." : null,
                JsonSerializer.Serialize(new
                {
                    sourceCount = groupedQueries.Length,
                    failedSourceCount = failedSources,
                    failedSources = failedSourceNames,
                    resultCount = totalResults
                }),
                now,
                phaseFinishedAt), transaction, cancellationToken);

            await repository.UpdateTopicRunAsync(new ResearchTopicRunRecord(
                runId,
                topic.Id,
                payload.RequestedByUserId ?? topic.RequestedByUserId,
                context.Job.Id,
                runStatus,
                payload.TriggeredBy,
                now,
                runFinishedAt,
                null,
                phaseStatus == ResearchTopicRunPhaseStatus.Failed ? "search_failed" : null,
                phaseStatus == ResearchTopicRunPhaseStatus.Failed ? "Search intake returned no results." : null,
                summaryPreview,
                now,
                updatedAt), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        context.ReportProgress(100, phaseStatus == ResearchTopicRunPhaseStatus.Succeeded ? "Completed" : "Completed with warnings");
        await context.LogInfoAsync("Research topic run completed", JsonSerializer.SerializeToElement(new
        {
            runId,
            topicId = topic.Id,
            sourceCount = groupedQueries.Length,
            failedSourceCount = failedSources,
            resultCount = totalResults,
            forceRun = payload.ForceRun
        }), cancellationToken);

        if (runStatus == ResearchTopicRunStatus.Failed)
        {
            return JobHandlerResult.DeadLetter(
                "search_intake_failed",
                "Research search intake returned no results.",
                JsonSerializer.SerializeToElement(new
                {
                    runId,
                    topicId = topic.Id,
                    failedSources = failedSourceNames
                }));
        }

        var fetchJob = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            ParentJobId = context.Job.Id,
            RequestedByUserId = payload.RequestedByUserId ?? topic.RequestedByUserId,
            JobType = "research.topic.fetch",
            Priority = 50,
            Status = JobStatus.Queued,
            Payload = JsonSerializer.SerializeToElement(new
            {
                researchTopicId = topic.Id,
                researchTopicRunId = runId,
                requestedByUserId = payload.RequestedByUserId ?? topic.RequestedByUserId,
                triggeredBy = payload.TriggeredBy,
                forceRun = payload.ForceRun
            }),
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        await context.LogInfoAsync("Queued research content acquisition job", JsonSerializer.SerializeToElement(new
        {
            fetchJobId = fetchJob.Id,
            runId,
            topicId = topic.Id
        }), cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
        {
            runId,
            topicId = topic.Id,
            sourceCount = groupedQueries.Length,
            resultCount = totalResults,
            failedSourceCount = failedSources,
            nextJobId = fetchJob.Id
        }));
    }

    private static ResearchTopicRunPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!payload.TryGetProperty("researchTopicId", out var researchTopicIdElement) || !researchTopicIdElement.TryGetGuid(out var researchTopicId))
        {
            return null;
        }

        Guid? requestedByUserId = null;
        if (payload.TryGetProperty("requestedByUserId", out var requestedByUserIdElement) && requestedByUserIdElement.ValueKind is JsonValueKind.String && requestedByUserIdElement.TryGetGuid(out var parsedRequestedByUserId))
        {
            requestedByUserId = parsedRequestedByUserId;
        }

        var triggeredBy = payload.TryGetProperty("triggeredBy", out var triggeredByElement)
            ? triggeredByElement.GetString()
            : null;

        var forceRun = payload.TryGetProperty("forceRun", out var forceRunElement) && forceRunElement.ValueKind == JsonValueKind.True;

        return new ResearchTopicRunPayload(researchTopicId, requestedByUserId, string.IsNullOrWhiteSpace(triggeredBy) ? "api" : triggeredBy.Trim(), forceRun);
    }

    private static string SerializeRawResult(ResearchSearchResult result)
        => JsonSerializer.Serialize(new
        {
            result.Url,
            result.Title,
            result.Content,
            result.RawResponse
        });

    private static string NormalizeUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var parsed) ? parsed.ToString() : url.Trim();

    private static string? TryGetDomain(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var parsed) ? parsed.Host : null;

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private sealed record ResearchTopicRunPayload(Guid ResearchTopicId, Guid? RequestedByUserId, string TriggeredBy, bool ForceRun);
}
