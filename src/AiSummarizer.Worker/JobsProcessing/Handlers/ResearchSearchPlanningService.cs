using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Prompts;
using AiSummarizer.Infrastructure.Research.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchSearchPlanningService(
    IResearchRepository researchRepository,
    IPromptsRepository promptsRepository,
    IReasoningClientFactory reasoningClientFactory,
    IOptions<ResearchSearchPlanningOptions> options,
    ILogger<ResearchSearchPlanningService> logger) : IResearchSearchPlanningService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    public async Task<ResearchSearchPlanRecord> EnsureSearchPlanAsync(Guid topicId, Guid? workflowId, Guid? jobId, string? stepKey, bool forceRefresh, CancellationToken cancellationToken)
    {
        var topic = await researchRepository.GetTopicByIdAsync(topicId, cancellationToken)
            ?? throw new ResearchSearchPlanningException("topic_not_found", $"Research topic {topicId} was not found.");

        var now = DateTimeOffset.UtcNow;
        var inputHash = ComputeHash(BuildPlanInput(topic));
        var existing = await researchRepository.GetSearchPlanByTopicIdAsync(topicId, cancellationToken);
        if (!forceRefresh
            && existing is not null
            && existing.Status == ResearchSearchPlanStatus.Ready
            && string.Equals(existing.InputHash, inputHash, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(existing.PlanJson))
        {
            return existing;
        }

        var prompt = await promptsRepository.GetPromptByKeyAsync(options.Value.PromptKey, cancellationToken);
        if (prompt is null)
        {
            var failed = BuildFailedPlan(existing, topicId, inputHash, now, options.Value.PromptKey, options.Value.PromptVersion, string.Empty, string.Empty, "prompt_not_found", $"Research search prompt {options.Value.PromptKey} was not found.");
            await researchRepository.UpsertSearchPlanAsync(failed, null, cancellationToken);
            throw new ResearchSearchPlanningException("prompt_not_found", $"Research search prompt {options.Value.PromptKey} was not found.");
        }

        if (!prompt.IsActive)
        {
            var failed = BuildFailedPlan(existing, topicId, inputHash, now, prompt.PromptKey, options.Value.PromptVersion, prompt.Provider, prompt.Model, "prompt_inactive", $"Research search prompt {prompt.PromptKey} is not active.");
            await researchRepository.UpsertSearchPlanAsync(failed, null, cancellationToken);
            throw new ResearchSearchPlanningException("prompt_inactive", $"Research search prompt {prompt.PromptKey} is not active.");
        }

        var requestJson = BuildPromptRequestJson(topic, existing, inputHash, workflowId, jobId, stepKey);
        var client = reasoningClientFactory.GetClient(ParseReasoningProvider(prompt.Provider));
        var systemPrompt = prompt.SystemPrompt.Trim();
        var userPrompt = RenderPrompt(prompt.UserPrompt, topic);
        var startedAt = DateTimeOffset.UtcNow;
        ReasoningResponse? response = null;

        try
        {
            response = await client.CompleteAsync(new ReasoningRequest(
                prompt.Model,
                systemPrompt,
                userPrompt,
                null,
                0.2,
                1200,
                "json"), cancellationToken);

            var plan = ParsePlan(response.Text);
            var normalizedPlan = NormalizePlan(plan);
            var planJson = JsonSerializer.Serialize(normalizedPlan, JsonOptions);
            var planRecord = new ResearchSearchPlanRecord(
                Guid.NewGuid(),
                topicId,
                existing is null ? 1 : existing.PlanVersion + 1,
                prompt.PromptKey,
                options.Value.PromptVersion,
                prompt.Provider,
                response.Model,
                ResearchSearchPlanStatus.Ready,
                planJson,
                inputHash,
                ComputeHash(planJson),
                DateTimeOffset.UtcNow,
                null,
                null,
                now,
                DateTimeOffset.UtcNow);

            await researchRepository.UpsertSearchPlanAsync(planRecord, null, cancellationToken);
            await promptsRepository.CreatePromptRunAsync(new PromptRun
            {
                Id = Guid.NewGuid(),
                PromptId = prompt.Id,
                WorkflowId = workflowId,
                StepKey = stepKey,
                PromptKey = prompt.PromptKey,
                Title = prompt.Title,
                WorkflowType = prompt.WorkflowType,
                Provider = prompt.Provider,
                Model = response.Model,
                Request = requestJson,
                Response = ParseResponseJson(response.RawResponseJson),
                Status = "succeeded",
                ErrorCode = null,
                ErrorMessage = null,
                InputTokens = response.Usage?.PromptTokens,
                OutputTokens = response.Usage?.CompletionTokens,
                TotalTokens = response.Usage?.TotalTokens,
                DurationMs = null,
                StartedAt = startedAt,
                FinishedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, cancellationToken);

            logger.LogInformation("Research search plan generated for topic {TopicId}", topicId);
            return planRecord;
        }
        catch (Exception ex)
        {
            var errorCode = ex is ResearchSearchPlanningException planningEx ? planningEx.ErrorCode : "llm_unavailable";
            var failed = BuildFailedPlan(existing, topicId, inputHash, now, prompt.PromptKey, options.Value.PromptVersion, prompt.Provider, prompt.Model, errorCode, ex.Message);
            await researchRepository.UpsertSearchPlanAsync(failed, null, cancellationToken);

            await promptsRepository.CreatePromptRunAsync(new PromptRun
            {
                Id = Guid.NewGuid(),
                PromptId = prompt.Id,
                WorkflowId = workflowId,
                StepKey = stepKey,
                PromptKey = prompt.PromptKey,
                Title = prompt.Title,
                WorkflowType = prompt.WorkflowType,
                Provider = prompt.Provider,
                Model = prompt.Model,
                Request = requestJson,
                Response = response is null ? null : ParseResponseJson(response.RawResponseJson),
                Status = "failed",
                ErrorCode = errorCode,
                ErrorMessage = ex.Message,
                InputTokens = response?.Usage?.PromptTokens,
                OutputTokens = response?.Usage?.CompletionTokens,
                TotalTokens = response?.Usage?.TotalTokens,
                DurationMs = null,
                StartedAt = startedAt,
                FinishedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, cancellationToken);

            logger.LogWarning(ex, "Research search plan generation failed for topic {TopicId}", topicId);
            throw new ResearchSearchPlanningException(errorCode, ex.Message, ex);
        }
    }

    private static ResearchSearchPlanRecord BuildFailedPlan(
        ResearchSearchPlanRecord? existing,
        Guid topicId,
        string inputHash,
        DateTimeOffset now,
        string promptKey,
        string promptVersion,
        string provider,
        string model,
        string errorCode,
        string errorMessage)
        => new(
            existing?.Id ?? Guid.NewGuid(),
            topicId,
            existing is null ? 1 : existing.PlanVersion,
            promptKey,
            promptVersion,
            provider,
            model,
            ResearchSearchPlanStatus.Failed,
            null,
            inputHash,
            existing?.SourceHash,
            null,
            errorCode,
            errorMessage,
            existing?.CreatedAt ?? now,
            now);

    private static string BuildPlanInput(ResearchTopicDto topic)
    {
        var payload = new
        {
            topic.Name,
            topic.Description,
            topic.Frequency,
            topic.Sources,
            topic.Tags,
            topic.Outputs
        };

        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    private JsonElement BuildPromptRequestJson(ResearchTopicDto topic, ResearchSearchPlanRecord? existing, string inputHash, Guid? workflowId, Guid? jobId, string? stepKey)
        => JsonSerializer.SerializeToElement(new
        {
            topicId = topic.Id,
            topicName = topic.Name,
            topicIntent = topic.Description,
            sources = topic.Sources,
            tags = topic.Tags,
            frequency = topic.Frequency,
            inputHash,
            existingPlanVersion = existing?.PlanVersion,
            workflowId,
            jobId,
            stepKey,
            promptKey = options.Value.PromptKey,
            promptVersion = options.Value.PromptVersion
        });

    private static string RenderPrompt(string template, ResearchTopicDto topic)
        => template
            .Replace("{{title}}", topic.Name.Trim(), StringComparison.Ordinal)
            .Replace("{{intent}}", topic.Description?.Trim() ?? string.Empty, StringComparison.Ordinal)
            .Replace("{{sources}}", string.Join(", ", topic.Sources), StringComparison.Ordinal)
            .Replace("{{tags}}", string.Join(", ", topic.Tags), StringComparison.Ordinal)
            .Replace("{{frequency}}", topic.Frequency.Trim(), StringComparison.Ordinal);

    private static ResearchSearchPlan ParsePlan(string text)
    {
        var json = ExtractJson(text);
        var plan = JsonSerializer.Deserialize<ResearchSearchPlan>(json, JsonOptions)
            ?? throw new ResearchSearchPlanningException("invalid_plan", "The research search plan could not be parsed.");

        plan = plan with
        {
            Keywords = plan.Keywords ?? Array.Empty<string>(),
            Entities = plan.Entities ?? Array.Empty<string>(),
            NegativeTerms = plan.NegativeTerms ?? Array.Empty<string>(),
            SourcePlans = plan.SourcePlans ?? Array.Empty<ResearchSearchSourcePlan>()
        };

        if (plan.SourcePlans.Count == 0)
        {
            throw new ResearchSearchPlanningException("invalid_plan", "The research search plan contained no source plans.");
        }

        if (string.IsNullOrWhiteSpace(plan.TopicSummary))
        {
            throw new ResearchSearchPlanningException("invalid_plan", "The research search plan did not include a topic summary.");
        }

        return plan;
    }

    private static ResearchSearchPlan NormalizePlan(ResearchSearchPlan plan)
        {
            var sourcePlans = (plan.SourcePlans ?? Array.Empty<ResearchSearchSourcePlan>())
                .Where(sourcePlan => sourcePlan is not null)
                .Select(sourcePlan => sourcePlan!)
                .Select(sourcePlan =>
                {
                    var queries = (sourcePlan.Queries ?? Array.Empty<string>())
                        .Select(query => query?.Trim())
                        .Where(query => !string.IsNullOrWhiteSpace(query))
                        .Select(query => query!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();

                    return sourcePlan with
                    {
                        Source = sourcePlan.Source?.Trim().ToLowerInvariant() ?? string.Empty,
                        Queries = queries,
                        Recency = string.IsNullOrWhiteSpace(sourcePlan.Recency) ? null : sourcePlan.Recency.Trim().ToLowerInvariant(),
                        ExcludeTerms = sourcePlan.ExcludeTerms?.Select(term => term?.Trim()).Where(term => !string.IsNullOrWhiteSpace(term)).Select(term => term!).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
                        MaxResults = sourcePlan.MaxResults is < 1 ? null : sourcePlan.MaxResults
                    };
                })
                .Where(sourcePlan => !string.IsNullOrWhiteSpace(sourcePlan.Source))
                .Where(sourcePlan => sourcePlan.Queries.Count > 0)
                .ToArray();

            return plan with
            {
                TopicSummary = plan.TopicSummary?.Trim() ?? string.Empty,
                Language = string.IsNullOrWhiteSpace(plan.Language) ? null : plan.Language.Trim(),
                Keywords = (plan.Keywords ?? Array.Empty<string>())
                    .Select(item => item?.Trim())
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Select(item => item!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                Entities = (plan.Entities ?? Array.Empty<string>())
                    .Select(item => item?.Trim())
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Select(item => item!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                NegativeTerms = (plan.NegativeTerms ?? Array.Empty<string>())
                    .Select(item => item?.Trim())
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Select(item => item!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                SourcePlans = sourcePlans
            };
        }

    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start)
        {
            throw new ResearchSearchPlanningException("invalid_plan", "The research search planner did not return JSON.");
        }

        return text[start..(end + 1)];
    }

    private static JsonElement ParseResponseJson(string rawResponseJson)
    {
        try
        {
            return JsonDocument.Parse(rawResponseJson).RootElement.Clone();
        }
        catch
        {
            return JsonSerializer.SerializeToElement(new
            {
                rawResponseJson
            });
        }
    }

    private static string ComputeHash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }

    private static ReasoningProvider ParseReasoningProvider(string provider)
        => Enum.TryParse<ReasoningProvider>(provider, true, out var parsed)
            ? parsed
            : provider.Trim().ToLowerInvariant() switch
            {
                "openrouter" => ReasoningProvider.OpenRouter,
                "googlevertex" or "vertex" or "google_vertex" => ReasoningProvider.GoogleVertex,
                "inceptionlabs" or "inception" => ReasoningProvider.InceptionLabs,
                "ollama" => ReasoningProvider.Ollama,
                _ => ReasoningProvider.OpenRouter
            };
}
