using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicRankJobHandler(
    IResearchRepository researchRepository,
    IJobsRepository jobsRepository,
    ILogger<ResearchTopicRankJobHandler> logger) : IJobHandler
{
    private const string ScoringVersion = "v1";
    private const int MaxSelectedDocuments = 30;

    private static readonly IReadOnlyDictionary<string, double> SourceWeights = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
    {
        ["web"] = 1.00,
        ["news"] = 1.15,
        ["archive"] = 0.80,
        ["reddit"] = 0.75,
        ["financial"] = 1.10,
        ["twitter"] = 0.70,
        ["youtube"] = 0.90
    };

    private static readonly IReadOnlyDictionary<string, int> SourceSelectionCaps = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["web"] = 8,
        ["news"] = 8,
        ["archive"] = 4,
        ["reddit"] = 4,
        ["financial"] = 4,
        ["twitter"] = 4,
        ["youtube"] = 5
    };

    public string JobType => "research.topic.rank";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic rank payload is missing researchTopicId or researchTopicRunId.", null);
        }

        var topic = await researchRepository.GetTopicByIdAsync(payload.ResearchTopicId, cancellationToken);
        if (topic is null)
        {
            return JobHandlerResult.DeadLetter(
                "topic_not_found",
                $"Research topic {payload.ResearchTopicId} was not found.",
                JsonSerializer.SerializeToElement(new { researchTopicId = payload.ResearchTopicId }));
        }

        var run = await researchRepository.GetTopicRunByIdAsync(payload.ResearchTopicRunId, cancellationToken);
        if (run is null)
        {
            return JobHandlerResult.DeadLetter(
                "run_not_found",
                $"Research topic run {payload.ResearchTopicRunId} was not found.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        var documents = await researchRepository.ListDocumentsAsync(payload.ResearchTopicRunId, 10_000, 0, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var rankingRunId = Guid.NewGuid();
        var phaseId = Guid.NewGuid();

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                run.Id,
                "ranking",
                ResearchTopicRunPhaseStatus.Running,
                1,
                now,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    scoringVersion = ScoringVersion,
                    documentCount = documents.Count,
                    maxSelectedDocuments = MaxSelectedDocuments
                }),
                now,
                now), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        if (documents.Count == 0)
        {
            var failedAt = DateTimeOffset.UtcNow;
            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.CreateRankingRunAsync(new ResearchRankingRunRecord(
                    rankingRunId,
                    run.Id,
                    phaseId,
                    topic.Id,
                    ResearchRankingRunStatus.Failed,
                    ScoringVersion,
                    0,
                    0,
                    now,
                    failedAt,
                    "no_documents_to_rank",
                    "Research topic run has no normalized documents to rank.",
                    JsonSerializer.Serialize(new
                    {
                        scoringVersion = ScoringVersion,
                        documentCount = 0,
                        maxSelectedDocuments = MaxSelectedDocuments
                    }),
                    now,
                    failedAt), transaction, cancellationToken);

                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    phaseId,
                    run.Id,
                    "ranking",
                    ResearchTopicRunPhaseStatus.Failed,
                    1,
                    now,
                    failedAt,
                    "no_documents_to_rank",
                    "Research topic run has no normalized documents to rank.",
                    JsonSerializer.Serialize(new
                    {
                        scoringVersion = ScoringVersion,
                        documentCount = 0,
                        maxSelectedDocuments = MaxSelectedDocuments
                    }),
                    now,
                    failedAt), transaction, cancellationToken);

                await repository.UpdateTopicRunAsync(new ResearchTopicRunRecord(
                    run.Id,
                    run.ResearchTopicId,
                    run.RequestedByUserId,
                    run.JobId,
                    ResearchTopicRunStatus.Failed,
                    run.TriggeredBy,
                    run.StartedAt,
                    failedAt,
                    null,
                    "no_documents_to_rank",
                    "Research topic run has no normalized documents to rank.",
                    run.SummaryPreview,
                    run.CreatedAt,
                    failedAt), transaction, cancellationToken);

                return 0;
            }, cancellationToken);

            return JobHandlerResult.DeadLetter(
                "no_documents_to_rank",
                "Research topic run has no normalized documents to rank.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateRankingRunAsync(new ResearchRankingRunRecord(
                rankingRunId,
                run.Id,
                phaseId,
                topic.Id,
                ResearchRankingRunStatus.Running,
                ScoringVersion,
                documents.Count,
                0,
                now,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    scoringVersion = ScoringVersion,
                    documentCount = documents.Count,
                    maxSelectedDocuments = MaxSelectedDocuments
                }),
                now,
                now), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        context.ReportProgress(10, "Ranking normalized documents");

        var ranked = documents
            .Select(document => BuildRankedDocument(rankingRunId, run.Id, topic.Id, document, now))
            .OrderByDescending(item => item.Score)
            .ThenByDescending(item => item.FreshnessScore)
            .ThenByDescending(item => item.CreatedAt)
            .ToArray();

        var selectedCountBySource = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var selectedCount = 0;

        for (var i = 0; i < ranked.Length; i++)
        {
            var candidate = ranked[i];
            var sourceCount = selectedCountBySource.TryGetValue(candidate.SourceKey, out var count) ? count : 0;
            var sourceCap = SourceSelectionCaps.TryGetValue(candidate.SourceKey, out var cap) ? cap : 4;
            var isSelected = selectedCount < MaxSelectedDocuments && sourceCount < sourceCap;

            if (isSelected)
            {
                selectedCountBySource[candidate.SourceKey] = sourceCount + 1;
                selectedCount++;
            }

            ranked[i] = candidate with { RankPosition = i, IsSelected = isSelected };
        }

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            foreach (var rankedDocument in ranked)
            {
                await repository.CreateRankedDocumentAsync(new ResearchRankedDocumentRecord(
                    Guid.NewGuid(),
                    rankedDocument.ResearchRankingRunId,
                    rankedDocument.ResearchTopicRunId,
                    rankedDocument.ResearchTopicId,
                    rankedDocument.ResearchDocumentId,
                    rankedDocument.SourceKey,
                    rankedDocument.Title,
                    rankedDocument.CanonicalUrl,
                    rankedDocument.Score,
                    rankedDocument.FreshnessScore,
                    rankedDocument.SourceWeight,
                    rankedDocument.LengthScore,
                    rankedDocument.RankPosition,
                    rankedDocument.IsSelected,
                    rankedDocument.ReasonJson,
                    now,
                    now), transaction, cancellationToken);
            }

            await repository.UpdateRankingRunAsync(new ResearchRankingRunRecord(
                rankingRunId,
                run.Id,
                phaseId,
                topic.Id,
                ResearchRankingRunStatus.Succeeded,
                ScoringVersion,
                documents.Count,
                selectedCount,
                now,
                now,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    scoringVersion = ScoringVersion,
                    documentCount = documents.Count,
                    selectedCount,
                    selectedBySource = selectedCountBySource
                }),
                now,
                now), transaction, cancellationToken);

            await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                run.Id,
                "ranking",
                ResearchTopicRunPhaseStatus.Succeeded,
                1,
                now,
                DateTimeOffset.UtcNow,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    scoringVersion = ScoringVersion,
                    documentCount = documents.Count,
                    selectedCount,
                    selectedBySource = selectedCountBySource
                }),
                now,
                DateTimeOffset.UtcNow), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        var synthJob = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            ParentJobId = context.Job.Id,
            RequestedByUserId = payload.RequestedByUserId ?? run.RequestedByUserId ?? topic.RequestedByUserId,
            JobType = "research.topic.synthesize",
            Priority = 50,
            Status = JobStatus.Queued,
            Payload = JsonSerializer.SerializeToElement(new
            {
                researchTopicId = topic.Id,
                researchTopicRunId = run.Id,
                requestedByUserId = payload.RequestedByUserId ?? run.RequestedByUserId ?? topic.RequestedByUserId,
                triggeredBy = payload.TriggeredBy
            }),
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        context.ReportProgress(100, "Completed");
        await context.LogInfoAsync("Research ranking completed", JsonSerializer.SerializeToElement(new
        {
            runId = run.Id,
            topicId = topic.Id,
            rankingRunId,
            documentCount = documents.Count,
            selectedCount,
            nextJobId = synthJob.Id
        }), cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
        {
            rankingRunId,
            runId = run.Id,
            topicId = topic.Id,
            documentCount = documents.Count,
            selectedCount,
            nextJobId = synthJob.Id
        }));
    }

    private static RankedDocument BuildRankedDocument(Guid rankingRunId, Guid runId, Guid topicId, ResearchDocumentDto document, DateTimeOffset now)
    {
        var sourceWeight = SourceWeights.TryGetValue(document.SourceKey, out var weight) ? weight : 0.75;
        var freshnessScore = GetFreshnessScore(document.PublishedAt ?? document.NormalizedAt, now);
        var lengthScore = GetLengthScore(document.CanonicalBody);
        var score = (sourceWeight * 0.45) + (freshnessScore * 0.35) + (lengthScore * 0.20);
        var reason = JsonSerializer.Serialize(new
        {
            sourceWeight,
            freshnessScore,
            lengthScore,
            scoringVersion = ScoringVersion
        });

        return new RankedDocument(
            Guid.NewGuid(),
            rankingRunId,
            runId,
            topicId,
            document.Id,
            document.SourceKey,
            document.Title,
            document.CanonicalUrl,
            score,
            freshnessScore,
            sourceWeight,
            lengthScore,
            0,
            false,
            reason,
            now,
            now);
    }

    private static double GetFreshnessScore(DateTimeOffset publishedAt, DateTimeOffset now)
    {
        var ageDays = Math.Max(0, (now - publishedAt).TotalDays);
        return ageDays switch
        {
            <= 1 => 1.00,
            <= 3 => 0.95,
            <= 7 => 0.90,
            <= 14 => 0.80,
            <= 30 => 0.65,
            _ => 0.50
        };
    }

    private static double GetLengthScore(string body)
    {
        var wordCount = CountWords(body);
        return Math.Min(1.0, wordCount / 1200.0);
    }

    private static int CountWords(string value)
        => System.Text.RegularExpressions.Regex.Matches(value, @"\b\w+\b").Count;

    private static ResearchTopicRankPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!payload.TryGetProperty("researchTopicId", out var researchTopicIdElement) || !researchTopicIdElement.TryGetGuid(out var researchTopicId))
        {
            return null;
        }

        if (!payload.TryGetProperty("researchTopicRunId", out var researchTopicRunIdElement) || !researchTopicRunIdElement.TryGetGuid(out var researchTopicRunId))
        {
            return null;
        }

        Guid? requestedByUserId = null;
        if (payload.TryGetProperty("requestedByUserId", out var requestedByUserIdElement) && requestedByUserIdElement.ValueKind == JsonValueKind.String && requestedByUserIdElement.TryGetGuid(out var parsedRequestedByUserId))
        {
            requestedByUserId = parsedRequestedByUserId;
        }

        var triggeredBy = payload.TryGetProperty("triggeredBy", out var triggeredByElement)
            ? triggeredByElement.GetString()
            : null;

        return new ResearchTopicRankPayload(researchTopicId, researchTopicRunId, requestedByUserId, string.IsNullOrWhiteSpace(triggeredBy) ? "api" : triggeredBy.Trim());
    }

    private sealed record ResearchTopicRankPayload(Guid ResearchTopicId, Guid ResearchTopicRunId, Guid? RequestedByUserId, string TriggeredBy);

    private sealed record RankedDocument(
        Guid Id,
        Guid ResearchRankingRunId,
        Guid ResearchTopicRunId,
        Guid ResearchTopicId,
        Guid ResearchDocumentId,
        string SourceKey,
        string Title,
        string CanonicalUrl,
        double Score,
        double FreshnessScore,
        double SourceWeight,
        double LengthScore,
        int RankPosition,
        bool IsSelected,
        string ReasonJson,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);
}
