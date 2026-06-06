using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Infrastructure.Research.Models;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicSynthesizeJobHandler(
    IResearchRepository researchRepository,
    IResearchService researchService,
    IReasoningClientFactory reasoningClientFactory,
    IOptions<ResearchSynthesisOptions> options,
    ILogger<ResearchTopicSynthesizeJobHandler> logger) : IJobHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    public string JobType => "research.topic.synthesize";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic synthesize payload is missing researchTopicId or researchTopicRunId.", null);
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

        var rankingRuns = await researchRepository.ListRankingRunsAsync(payload.ResearchTopicRunId, cancellationToken);
        var rankedDocuments = await researchRepository.ListRankedDocumentsAsync(payload.ResearchTopicRunId, 10_000, 0, cancellationToken);
        var documents = await researchRepository.ListDocumentsAsync(payload.ResearchTopicRunId, 10_000, 0, cancellationToken);

        if (rankingRuns.Count == 0 || rankedDocuments.Count == 0 || documents.Count == 0)
        {
            return JobHandlerResult.DeadLetter(
                "insufficient_ranked_documents",
                "Research topic run has no ranked documents to synthesize.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        var selectedDocumentIds = rankedDocuments.Where(item => item.IsSelected).Select(item => item.ResearchDocumentId).ToHashSet();
        var selectedDocuments = documents
            .Where(document => selectedDocumentIds.Contains(document.Id))
            .OrderBy(document => rankedDocuments.First(rank => rank.ResearchDocumentId == document.Id).RankPosition)
            .Take(Math.Max(1, options.Value.MaxSelectedDocuments))
            .ToArray();

        if (selectedDocuments.Length == 0)
        {
            selectedDocuments = documents
                .OrderBy(document => rankedDocuments.First(rank => rank.ResearchDocumentId == document.Id).RankPosition)
                .Take(Math.Max(1, options.Value.MaxSelectedDocuments))
                .ToArray();
        }

        var selectedRankings = rankedDocuments.Where(item => item.IsSelected).ToArray();
        if (selectedRankings.Length == 0)
        {
            selectedRankings = rankedDocuments
                .OrderBy(item => item.RankPosition)
                .Take(Math.Max(1, selectedDocuments.Length))
                .ToArray();
        }

        var now = DateTimeOffset.UtcNow;
        var synthesisRunId = Guid.NewGuid();
        var synthesisPhaseId = Guid.NewGuid();
        var synthesisInput = BuildSynthesisInput(topic, run, selectedRankings, selectedDocuments, now, options.Value.MaxCharsPerDocument);
        var synthesisInputJson = JsonSerializer.Serialize(synthesisInput, JsonOptions);
        var inputHash = ComputeHash(synthesisInputJson);
        Guid? persistencePhaseId = null;
        ReasoningResponse? reasoningResponse = null;
        ResearchBriefingDto? briefing = null;
        string? responseJson = null;
        string? outputJson = null;
        string? usageJson = null;

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                synthesisPhaseId,
                run.Id,
                "synthesis",
                ResearchTopicRunPhaseStatus.Running,
                1,
                now,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    synthesisRunId,
                    rankingRunId = rankingRuns[^1].Id,
                    selectedDocumentCount = selectedDocuments.Length,
                    promptVersion = options.Value.PromptVersion
                }),
                now,
                now), transaction, cancellationToken);

            await repository.CreateSynthesisRunAsync(new ResearchSynthesisRunRecord(
                synthesisRunId,
                run.Id,
                synthesisPhaseId,
                topic.Id,
                rankingRuns[^1].Id,
                ResearchSynthesisRunStatus.Running,
                options.Value.Provider.ToString(),
                options.Value.Model ?? string.Empty,
                options.Value.PromptVersion,
                inputHash,
                synthesisInputJson,
                null,
                null,
                null,
                selectedDocuments.Length,
                now,
                null,
                null,
                null,
                null,
                now,
                now), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        try
        {
            context.ReportProgress(10, "Synthesizing briefing");

            var client = reasoningClientFactory.GetClient(options.Value.Provider);
            var systemPrompt = BuildSystemPrompt();
            var userPrompt = BuildUserPrompt(synthesisInput);
            reasoningResponse = await client.CompleteAsync(new ReasoningRequest(
                options.Value.Model,
                systemPrompt,
                userPrompt,
                null,
                options.Value.Temperature,
                options.Value.MaxTokens,
                "json"), cancellationToken);

            var parsedOutput = ParseSynthesisOutput(reasoningResponse.Text);
            responseJson = reasoningResponse.RawResponseJson;
            outputJson = JsonSerializer.Serialize(parsedOutput, JsonOptions);
            usageJson = reasoningResponse.Usage is null ? null : JsonSerializer.Serialize(new
            {
                promptTokens = reasoningResponse.Usage.PromptTokens,
                completionTokens = reasoningResponse.Usage.CompletionTokens,
                totalTokens = reasoningResponse.Usage.TotalTokens
            }, JsonOptions);

            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateSynthesisRunAsync(new ResearchSynthesisRunRecord(
                    synthesisRunId,
                    run.Id,
                    synthesisPhaseId,
                    topic.Id,
                    rankingRuns[^1].Id,
                    ResearchSynthesisRunStatus.Succeeded,
                    options.Value.Provider.ToString(),
                    reasoningResponse.Model,
                    options.Value.PromptVersion,
                    inputHash,
                    synthesisInputJson,
                    responseJson,
                    outputJson,
                    usageJson,
                    selectedDocuments.Length,
                    now,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    null,
                    now,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);

                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    synthesisPhaseId,
                    run.Id,
                    "synthesis",
                    ResearchTopicRunPhaseStatus.Succeeded,
                    1,
                    now,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    JsonSerializer.Serialize(new
                    {
                        synthesisRunId,
                        rankingRunId = rankingRuns[^1].Id,
                        selectedDocumentCount = selectedDocuments.Length,
                        provider = reasoningResponse.Provider.ToString(),
                        model = reasoningResponse.Model,
                        usage = reasoningResponse.Usage
                    }),
                    now,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);

                return 0;
            }, cancellationToken);

            persistencePhaseId = Guid.NewGuid();
            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    persistencePhaseId.Value,
                    run.Id,
                    "persistence",
                    ResearchTopicRunPhaseStatus.Running,
                    1,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    null,
                    JsonSerializer.Serialize(new
                    {
                        synthesisRunId,
                        selectedDocumentCount = selectedDocuments.Length
                    }),
                    DateTimeOffset.UtcNow,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            briefing = await researchService.CreateBriefingAsync(run.ResearchTopicId, new CreateResearchBriefingCommand(
                payload.RequestedByUserId ?? run.RequestedByUserId ?? topic.RequestedByUserId,
                DateTimeOffset.UtcNow,
                parsedOutput.PeriodLabel,
                parsedOutput.ReadTimeMinutes,
                parsedOutput.WordCount,
                parsedOutput.Summary,
                parsedOutput.PreviewText,
                null,
                parsedOutput.Sections.Select(section => new ResearchBriefingSectionInput(section.Title, section.Sentiment, section.Items)).ToArray(),
                parsedOutput.Sources.Select(source => new ResearchBriefingSourceInput(source.Title, source.Domain)).ToArray()), cancellationToken);

            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateSynthesisRunAsync(new ResearchSynthesisRunRecord(
                    synthesisRunId,
                    run.Id,
                    synthesisPhaseId,
                    topic.Id,
                    rankingRuns[^1].Id,
                    ResearchSynthesisRunStatus.Succeeded,
                    options.Value.Provider.ToString(),
                    reasoningResponse.Model,
                    options.Value.PromptVersion,
                    inputHash,
                    synthesisInputJson,
                    responseJson,
                    outputJson,
                    usageJson,
                    selectedDocuments.Length,
                    now,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    briefing.Id,
                    now,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);

                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    persistencePhaseId.Value,
                    run.Id,
                    "persistence",
                    ResearchTopicRunPhaseStatus.Succeeded,
                    1,
                    DateTimeOffset.UtcNow,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    JsonSerializer.Serialize(new
                    {
                        synthesisRunId,
                        briefingId = briefing.Id,
                        previewText = briefing.PreviewText
                    }),
                    DateTimeOffset.UtcNow,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);

                await repository.UpdateTopicRunAsync(new ResearchTopicRunRecord(
                    run.Id,
                    run.ResearchTopicId,
                    run.RequestedByUserId,
                    run.JobId,
                    ResearchTopicRunStatus.Succeeded,
                    run.TriggeredBy,
                    run.StartedAt,
                    DateTimeOffset.UtcNow,
                    null,
                    null,
                    null,
                    briefing.PreviewText,
                    run.CreatedAt,
                    DateTimeOffset.UtcNow), transaction, cancellationToken);

                return 0;
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Research synthesis failed for run {RunId}", run.Id);
            var failedAt = DateTimeOffset.UtcNow;

            await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateSynthesisRunAsync(new ResearchSynthesisRunRecord(
                    synthesisRunId,
                    run.Id,
                    synthesisPhaseId,
                    topic.Id,
                    rankingRuns[^1].Id,
                    ResearchSynthesisRunStatus.Failed,
                    options.Value.Provider.ToString(),
                    reasoningResponse?.Model ?? options.Value.Model ?? string.Empty,
                    options.Value.PromptVersion,
                    inputHash,
                    synthesisInputJson,
                    responseJson,
                    outputJson,
                    usageJson,
                    selectedDocuments.Length,
                    now,
                    failedAt,
                    "synthesis_failed",
                    ex.Message,
                    briefing?.Id,
                    now,
                    failedAt), transaction, cancellationToken);

                await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                    synthesisPhaseId,
                    run.Id,
                    "synthesis",
                    ResearchTopicRunPhaseStatus.Failed,
                    1,
                    now,
                    failedAt,
                    "synthesis_failed",
                    ex.Message,
                    JsonSerializer.Serialize(new
                    {
                        synthesisRunId,
                        rankingRunId = rankingRuns[^1].Id,
                        selectedDocumentCount = selectedDocuments.Length,
                        error = ex.GetType().FullName
                    }),
                    now,
                    failedAt), transaction, cancellationToken);

                if (persistencePhaseId is not null)
                {
                    await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                        persistencePhaseId.Value,
                        run.Id,
                        "persistence",
                        ResearchTopicRunPhaseStatus.Failed,
                        1,
                        failedAt,
                        failedAt,
                        "synthesis_failed",
                        ex.Message,
                        JsonSerializer.Serialize(new
                        {
                            synthesisRunId,
                            selectedDocumentCount = selectedDocuments.Length,
                            error = ex.GetType().FullName
                        }),
                        failedAt,
                        failedAt), transaction, cancellationToken);
                }

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
                    "synthesis_failed",
                    ex.Message,
                    run.SummaryPreview,
                    run.CreatedAt,
                    failedAt), transaction, cancellationToken);

                return 0;
            }, cancellationToken);

            return JobHandlerResult.DeadLetter(
                "synthesis_failed",
                ex.Message,
                JsonSerializer.SerializeToElement(new
                {
                    runId = run.Id,
                    topicId = topic.Id,
                    synthesisRunId
                }));
        }

        context.ReportProgress(100, "Completed");
        await context.LogInfoAsync("Research synthesis completed", JsonSerializer.SerializeToElement(new
        {
            runId = run.Id,
            topicId = topic.Id,
            synthesisRunId,
            briefingId = briefing!.Id,
            selectedDocumentCount = selectedDocuments.Length
        }), cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
        {
            synthesisRunId,
            briefingId = briefing!.Id,
            runId = run.Id,
            topicId = topic.Id,
            selectedDocumentCount = selectedDocuments.Length
        }));
    }

    private static SynthesisPayload? ParsePayload(JsonElement payload)
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

        return new SynthesisPayload(researchTopicId, researchTopicRunId, requestedByUserId, string.IsNullOrWhiteSpace(triggeredBy) ? "api" : triggeredBy.Trim());
    }

    private static object BuildSynthesisInput(ResearchTopicDto topic, ResearchTopicRunDto run, IReadOnlyList<ResearchRankedDocumentDto> rankedDocuments, IReadOnlyList<ResearchDocumentDto> selectedDocuments, DateTimeOffset now, int maxCharsPerDocument)
    {
        var selectedRankings = rankedDocuments
            .Where(item => item.IsSelected)
            .Take(Math.Max(1, selectedDocuments.Count))
            .Select(item => new
            {
                item.RankPosition,
                item.SourceKey,
                item.Title,
                item.CanonicalUrl,
                item.Score,
                item.FreshnessScore,
                item.SourceWeight,
                item.LengthScore,
                item.ReasonJson
            })
            .ToArray();

        return new
        {
            topic = new
            {
                topic.Id,
                topic.Name,
                topic.Description,
                topic.Frequency,
                topic.Tags,
                topic.Outputs
            },
            run = new
            {
                run.Id,
                run.ResearchTopicId,
                run.TriggeredBy,
                now
            },
            documents = selectedDocuments.Select(document => new
            {
                document.Id,
                document.SourceKey,
                document.Title,
                document.CanonicalUrl,
                document.AuthorName,
                document.PublishedAt,
                excerpt = Truncate(document.CanonicalBody, maxCharsPerDocument)
            }).ToArray(),
            ranked = selectedRankings
        };
    }

    private static string BuildSystemPrompt()
        => """
           You are a research synthesis engine.
           Produce only valid JSON matching this schema:
           {
             "periodLabel": "string",
             "readTimeMinutes": 12,
             "wordCount": 1200,
             "summary": "string",
             "previewText": "string",
             "sections": [
               { "title": "string", "sentiment": "positive|neutral|negative", "items": ["string"] }
             ],
             "sources": [
               { "title": "string", "domain": "string" }
             ]
           }
           Keep the summary concise, structured, and grounded in the provided evidence.
           """;

    private static string BuildUserPrompt(object synthesisInput)
        => JsonSerializer.Serialize(new
        {
            instructions = "Use the evidence to write a weekly or daily research briefing.",
            evidence = synthesisInput
        }, JsonOptions);

    private static ResearchSynthesisOutput ParseSynthesisOutput(string text)
    {
        var json = ExtractJson(text);
        var output = JsonSerializer.Deserialize<ResearchSynthesisOutput>(json, JsonOptions);
        if (output is null)
        {
            throw new InvalidOperationException("Synthesis output could not be parsed.");
        }

        return output;
    }

    private static string ExtractJson(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            trimmed = Regex.Replace(trimmed, "^```(?:json)?\\s*", string.Empty, RegexOptions.IgnoreCase);
            trimmed = Regex.Replace(trimmed, "\\s*```$", string.Empty);
        }

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start)
        {
            return trimmed[start..(end + 1)];
        }

        return trimmed;
    }

    private static string Truncate(string value, int maxChars)
        => value.Length <= maxChars ? value : value[..maxChars];

    private static string ComputeHash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private sealed record SynthesisPayload(Guid ResearchTopicId, Guid ResearchTopicRunId, Guid? RequestedByUserId, string TriggeredBy);
}
