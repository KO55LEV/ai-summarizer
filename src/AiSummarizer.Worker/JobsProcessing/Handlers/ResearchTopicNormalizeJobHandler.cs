using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicNormalizeJobHandler(
    IResearchRepository researchRepository,
    IJobsRepository jobsRepository,
    ILogger<ResearchTopicNormalizeJobHandler> logger) : IJobHandler
{
    private const string NormalizerVersion = "v1";

    public string JobType => "research.topic.normalize";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic normalize payload is missing researchTopicId or researchTopicRunId.", null);
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

        var contentItems = await researchRepository.ListContentItemsAsync(payload.ResearchTopicRunId, 10_000, 0, cancellationToken);
        var candidates = contentItems
            .Where(item => item.Status == ResearchContentItemStatus.Succeeded && !string.IsNullOrWhiteSpace(item.RawText))
            .ToArray();

        var now = DateTimeOffset.UtcNow;
        var phaseId = Guid.NewGuid();
        var documentCount = 0;
        var chunkCount = 0;
        var duplicateCount = 0;
        var skippedCount = 0;
        var seenHashes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                run.Id,
                "normalization",
                ResearchTopicRunPhaseStatus.Running,
                1,
                now,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    contentItemCount = candidates.Length,
                    normalizerVersion = NormalizerVersion
                }),
                now,
                now), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        if (candidates.Length == 0)
        {
            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    phaseId,
                    run.Id,
                    "normalization",
                    ResearchTopicRunPhaseStatus.Failed,
                    1,
                    now,
                    now,
                    "no_content_to_normalize",
                    "Research topic run has no content items to normalize.",
                    JsonSerializer.Serialize(new
                    {
                        contentItemCount = 0,
                        normalizerVersion = NormalizerVersion
                    }),
                    now,
                    now), transaction, cancellationToken);

                await repository.UpdateTopicRunAsync(new ResearchTopicRunRecord(
                    run.Id,
                    run.ResearchTopicId,
                    run.RequestedByUserId,
                    run.JobId,
                    ResearchTopicRunStatus.Failed,
                    run.TriggeredBy,
                    run.StartedAt,
                    now,
                    null,
                    "no_content_to_normalize",
                    "Research topic run has no content items to normalize.",
                    run.SummaryPreview,
                    run.CreatedAt,
                    now), transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            return JobHandlerResult.DeadLetter(
                "no_content_to_normalize",
                "Research topic run has no content items to normalize.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        context.ReportProgress(5, "Normalizing raw content");

        foreach (var item in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var canonicalBody = NormalizeBody(item.RawText!);
            if (string.IsNullOrWhiteSpace(canonicalBody))
            {
                skippedCount++;
                continue;
            }

            var canonicalHash = ComputeHash(canonicalBody);
            if (!seenHashes.Add(canonicalHash))
            {
                duplicateCount++;
                continue;
            }

            var documentId = Guid.NewGuid();
            var rawContentHash = string.IsNullOrWhiteSpace(item.ContentHash) ? ComputeHash(item.RawText!) : item.ContentHash!;
            var document = new ResearchDocumentRecord(
                documentId,
                item.Id,
                item.ResearchTopicRunId,
                item.ResearchTopicId,
                item.SourceKey,
                item.CanonicalUrl ?? item.SourceUrl,
                item.Title,
                item.AuthorName,
                item.PublishedAt,
                now,
                canonicalBody,
                canonicalHash,
                rawContentHash,
                JsonSerializer.Serialize(new
                {
                    contentItemId = item.Id,
                    sourceKey = item.SourceKey,
                    sourceUrl = item.SourceUrl,
                    canonicalUrl = item.CanonicalUrl,
                    fetchMethod = item.FetchMethod,
                    contentType = item.ContentType,
                    sourceMetadata = TryParseJson(item.RawMetadataJson)
                }),
                NormalizerVersion,
                now,
                now);

            var chunks = BuildChunks(canonicalBody)
                .Select(chunk => new ResearchDocumentChunkRecord(
                    Guid.NewGuid(),
                    documentId,
                    chunk.Index,
                    chunk.Index == 0 ? item.Title : null,
                    chunk.Text,
                    CountWords(chunk.Text),
                    chunk.StartOffset,
                    chunk.EndOffset,
                    ComputeHash(chunk.Text),
                    JsonSerializer.Serialize(new
                    {
                        contentItemId = item.Id,
                        sourceKey = item.SourceKey,
                        chunkIndex = chunk.Index
                    }),
                    now,
                    now))
                .ToArray();

            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.CreateDocumentAsync(document, transaction, cancellationToken);
                foreach (var chunk in chunks)
                {
                    await repository.CreateDocumentChunkAsync(chunk, transaction, cancellationToken);
                }

                return 0;
            }, cancellationToken);

            documentCount++;
            chunkCount += chunks.Length;
            context.ReportProgress((short)Math.Clamp(5 + (documentCount * 90 / Math.Max(1, candidates.Length)), 5, 95), $"Normalized {documentCount}/{candidates.Length}");
        }

        if (documentCount == 0)
        {
            var failedAt = DateTimeOffset.UtcNow;
            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    phaseId,
                    run.Id,
                    "normalization",
                    ResearchTopicRunPhaseStatus.Failed,
                    1,
                    now,
                    failedAt,
                    "no_normalized_documents",
                    "Normalization produced no documents.",
                    JsonSerializer.Serialize(new
                    {
                        contentItemCount = candidates.Length,
                        documentCount,
                        chunkCount,
                        duplicateCount,
                        skippedCount
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
                    "no_normalized_documents",
                    "Normalization produced no documents.",
                    run.SummaryPreview,
                    run.CreatedAt,
                    failedAt), transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            return JobHandlerResult.DeadLetter(
                "no_normalized_documents",
                "Normalization produced no documents.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        var finishedAt = DateTimeOffset.UtcNow;
        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                phaseId,
                run.Id,
                "normalization",
                ResearchTopicRunPhaseStatus.Succeeded,
                1,
                now,
                finishedAt,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    contentItemCount = candidates.Length,
                    documentCount,
                    chunkCount,
                    duplicateCount,
                    skippedCount
                }),
                now,
                finishedAt), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        context.ReportProgress(100, "Completed");
        await context.LogInfoAsync("Research normalization completed", JsonSerializer.SerializeToElement(new
        {
            runId = run.Id,
            topicId = topic.Id,
            contentItemCount = candidates.Length,
            documentCount,
            chunkCount,
            duplicateCount,
            skippedCount
        }), cancellationToken);

        var rankJob = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            ParentJobId = context.Job.Id,
            RequestedByUserId = payload.RequestedByUserId ?? run.RequestedByUserId ?? topic.RequestedByUserId,
            JobType = "research.topic.rank",
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

        await context.LogInfoAsync("Queued research ranking job", JsonSerializer.SerializeToElement(new
        {
            rankJobId = rankJob.Id,
            runId = run.Id,
            topicId = topic.Id
        }), cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
        {
            runId = run.Id,
            topicId = topic.Id,
            contentItemCount = candidates.Length,
            documentCount,
            chunkCount,
            duplicateCount,
            skippedCount,
            nextJobId = rankJob.Id
        }));
    }

    private static ResearchTopicNormalizePayload? ParsePayload(JsonElement payload)
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

        return new ResearchTopicNormalizePayload(researchTopicId, researchTopicRunId, requestedByUserId, string.IsNullOrWhiteSpace(triggeredBy) ? "api" : triggeredBy.Trim());
    }

    private static string NormalizeBody(string text)
    {
        var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
        normalized = Regex.Replace(normalized, @"[ \t]+", " ");
        var lines = normalized.Split('\n', StringSplitOptions.None)
            .Select(line => line.Trim())
            .ToArray();

        var builder = new StringBuilder();
        var blankLineCount = 0;

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                blankLineCount++;
                if (builder.Length > 0 && blankLineCount == 1)
                {
                    builder.AppendLine();
                }
                continue;
            }

            blankLineCount = 0;
            if (builder.Length > 0 && builder[^1] != '\n')
            {
                builder.AppendLine();
            }

            builder.Append(line);
        }

        return builder.ToString().Trim();
    }

    private static IEnumerable<(int Index, string Text, int StartOffset, int EndOffset)> BuildChunks(string text)
    {
        const int maxChunkLength = 2800;
        var index = 0;
        var offset = 0;

        while (offset < text.Length)
        {
            var remaining = text.Length - offset;
            var length = Math.Min(maxChunkLength, remaining);
            var slice = text.Substring(offset, length);

            if (length == maxChunkLength && offset + length < text.Length)
            {
                var breakIndex = slice.LastIndexOfAny(['\n', '.', '!', '?', ' ']);
                if (breakIndex > maxChunkLength / 2)
                {
                    length = breakIndex + 1;
                    slice = text.Substring(offset, length);
                }
            }

            slice = slice.Trim();
            if (!string.IsNullOrWhiteSpace(slice))
            {
                var startOffset = offset;
                var endOffset = offset + length;
                yield return (index++, slice, startOffset, endOffset);
            }

            offset += Math.Max(1, length);
        }
    }

    private static int CountWords(string value)
        => Regex.Matches(value, @"\b\w+\b").Count;

    private static string ComputeHash(string value)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static JsonElement? TryParseJson(string? rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return null;
        }

        try
        {
            return JsonDocument.Parse(rawJson).RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    private sealed record ResearchTopicNormalizePayload(Guid ResearchTopicId, Guid ResearchTopicRunId, Guid? RequestedByUserId, string TriggeredBy);
}
