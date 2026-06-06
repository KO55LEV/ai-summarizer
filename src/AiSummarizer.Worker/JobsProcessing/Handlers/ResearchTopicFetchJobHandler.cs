using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class ResearchTopicFetchJobHandler(
    IResearchRepository researchRepository,
    IJobsRepository jobsRepository,
    IHttpClientFactory httpClientFactory,
    IOptions<YouTubeDownloadOptions> youtubeOptions,
    ILogger<ResearchTopicFetchJobHandler> logger) : IJobHandler
{
    private static readonly Regex TitleRegex = new(@"<title[^>]*>(?<title>.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex ScriptStyleRegex = new(@"<(script|style)[^>]*>.*?</\1>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex TagRegex = new(@"<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex VttTimestampRegex = new(@"^(?<start>\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(?<end>\d{2}:\d{2}:\d{2}\.\d{3})", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string JobType => "research.topic.fetch";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Research topic fetch payload is missing researchTopicId or researchTopicRunId.", null);
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

        var searchResults = await researchRepository.ListSearchResultsAsync(payload.ResearchTopicRunId, 10_000, 0, cancellationToken);
        if (searchResults.Count == 0)
        {
            return JobHandlerResult.DeadLetter(
                "no_search_results",
                "Research topic run has no search results to fetch.",
                JsonSerializer.SerializeToElement(new { researchTopicRunId = payload.ResearchTopicRunId }));
        }

        var now = DateTimeOffset.UtcNow;
        var contentRunId = Guid.NewGuid();
        var contentPhaseId = Guid.NewGuid();
        var contentRunStartedAt = now;

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                contentPhaseId,
                run.Id,
                "content_acquisition",
                ResearchTopicRunPhaseStatus.Running,
                1,
                contentRunStartedAt,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    contentRunId,
                    sourceCount = searchResults.Select(item => item.SourceKey).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                    resultCount = searchResults.Count
                }),
                contentRunStartedAt,
                contentRunStartedAt), transaction, cancellationToken);

            await repository.CreateContentRunAsync(new ResearchContentRunRecord(
                contentRunId,
                run.Id,
                contentPhaseId,
                topic.Id,
                ResearchContentRunStatus.Running,
                contentRunStartedAt,
                null,
                null,
                null,
                JsonSerializer.Serialize(new
                {
                    sourceCount = searchResults.Select(item => item.SourceKey).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                    resultCount = searchResults.Count
                }),
                contentRunStartedAt,
                contentRunStartedAt), transaction, cancellationToken);

            return 0;
        }, cancellationToken);

        context.ReportProgress(5, "Starting content acquisition");

        var uniqueResults = searchResults
            .GroupBy(result => NormalizeUrl(result.CanonicalUrl ?? result.Url), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(item => item.Score).First())
            .ToArray();

        var successfulItems = 0;
        var failedItems = 0;
        var itemErrors = new List<string>();

        foreach (var result in uniqueResults)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var itemId = Guid.NewGuid();
            var itemStartedAt = DateTimeOffset.UtcNow;

            try
            {
                var fetched = await FetchAsync(result, cancellationToken);
                var itemRecord = new ResearchContentItemRecord(
                    itemId,
                    contentRunId,
                    run.Id,
                    topic.Id,
                    result.SourceKey,
                    result.Url,
                    fetched.CanonicalUrl ?? result.CanonicalUrl ?? NormalizeUrl(result.Url),
                    fetched.Title ?? result.Title,
                    fetched.AuthorName,
                    fetched.PublishedAt,
                    fetched.FetchMethod,
                    fetched.ContentType,
                    ResearchContentItemStatus.Succeeded,
                    fetched.ContentHash,
                    fetched.RawText,
                    fetched.RawStoragePath,
                    fetched.RawMetadataJson,
                    null,
                    null,
                    itemStartedAt,
                    DateTimeOffset.UtcNow);

                await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
                {
                    await repository.CreateContentItemAsync(itemRecord, transaction, cancellationToken);
                    return 0;
                }, cancellationToken);

                successfulItems++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Content acquisition failed for {Url}", result.Url);
                itemErrors.Add(result.Url);
                failedItems++;

                var failedRecord = new ResearchContentItemRecord(
                    itemId,
                    contentRunId,
                    run.Id,
                    topic.Id,
                    result.SourceKey,
                    result.Url,
                    result.CanonicalUrl ?? NormalizeUrl(result.Url),
                    result.Title,
                    null,
                    null,
                    IsYouTubeUrl(result.Url) ? "youtube_transcript" : "http_fetch",
                    "text/plain",
                    ResearchContentItemStatus.Failed,
                    null,
                    null,
                    null,
                    null,
                    null,
                    ex.Message,
                    itemStartedAt,
                    DateTimeOffset.UtcNow);

                await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
                {
                    await repository.CreateContentItemAsync(failedRecord, transaction, cancellationToken);
                    return 0;
                }, cancellationToken);
            }

            context.ReportProgress((short)Math.Clamp(5 + ((successfulItems + failedItems) * 90 / Math.Max(1, uniqueResults.Length)), 5, 95), $"Fetched {successfulItems}/{uniqueResults.Length}");
        }

        var finishedAt = DateTimeOffset.UtcNow;
        var contentSucceeded = successfulItems > 0;
        var contentRunStatus = contentSucceeded ? ResearchContentRunStatus.Succeeded : ResearchContentRunStatus.Failed;
        var phaseStatus = contentSucceeded ? ResearchTopicRunPhaseStatus.Succeeded : ResearchTopicRunPhaseStatus.Failed;

        await researchRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateContentRunAsync(new ResearchContentRunRecord(
                contentRunId,
                run.Id,
                contentPhaseId,
                topic.Id,
                contentRunStatus,
                contentRunStartedAt,
                finishedAt,
                contentSucceeded ? null : "content_fetch_failed",
                contentSucceeded ? null : "Content acquisition did not fetch any items.",
                JsonSerializer.Serialize(new
                {
                    total = uniqueResults.Length,
                    successful = successfulItems,
                    failed = failedItems,
                    failures = itemErrors
                }),
                contentRunStartedAt,
                finishedAt), transaction, cancellationToken);

            await repository.UpdateTopicRunPhaseAsync(new ResearchTopicRunPhaseRecord(
                contentPhaseId,
                run.Id,
                "content_acquisition",
                phaseStatus,
                1,
                contentRunStartedAt,
                finishedAt,
                contentSucceeded ? null : "content_fetch_failed",
                contentSucceeded ? null : "Content acquisition did not fetch any items.",
                JsonSerializer.Serialize(new
                {
                    total = uniqueResults.Length,
                    successful = successfulItems,
                    failed = failedItems
                }),
                contentRunStartedAt,
                finishedAt), transaction, cancellationToken);

            if (!contentSucceeded)
            {
                await repository.UpdateTopicRunAsync(new ResearchTopicRunRecord(
                    run.Id,
                    run.ResearchTopicId,
                    run.RequestedByUserId,
                    run.JobId,
                    ResearchTopicRunStatus.Failed,
                    run.TriggeredBy,
                    run.StartedAt,
                    finishedAt,
                    null,
                    "content_fetch_failed",
                    "Content acquisition did not fetch any items.",
                    run.SummaryPreview,
                    run.CreatedAt,
                    finishedAt), transaction, cancellationToken);
            }

            return 0;
        }, cancellationToken);

        context.ReportProgress(100, contentSucceeded ? "Completed" : "Completed with errors");
        await context.LogInfoAsync("Research content acquisition completed", JsonSerializer.SerializeToElement(new
        {
            contentRunId,
            runId = run.Id,
            topicId = topic.Id,
            successfulItems,
            failedItems
        }), cancellationToken);

        if (!contentSucceeded)
        {
            return JobHandlerResult.DeadLetter(
                "content_fetch_failed",
                "Content acquisition did not fetch any items.",
                JsonSerializer.SerializeToElement(new
                {
                    contentRunId,
                    runId = run.Id,
                    failedItems
                }));
        }

        var normalizeJob = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            ParentJobId = context.Job.Id,
            RequestedByUserId = payload.RequestedByUserId ?? run.RequestedByUserId ?? topic.RequestedByUserId,
            JobType = "research.topic.normalize",
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

        await context.LogInfoAsync("Queued research normalization job", JsonSerializer.SerializeToElement(new
        {
            normalizeJobId = normalizeJob.Id,
            runId = run.Id,
            topicId = topic.Id
        }), cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
        {
            contentRunId,
            runId = run.Id,
            topicId = topic.Id,
            successfulItems,
            failedItems,
            nextJobId = normalizeJob.Id
        }));
    }

    private async Task<FetchedContent> FetchAsync(ResearchSearchResultDto result, CancellationToken cancellationToken)
    {
        if (IsYouTubeUrl(result.Url) || result.SourceKey.Equals("youtube", StringComparison.OrdinalIgnoreCase))
        {
            return await FetchYouTubeAsync(result, cancellationToken);
        }

        return await FetchHtmlAsync(result, cancellationToken);
    }

    private async Task<FetchedContent> FetchHtmlAsync(ResearchSearchResultDto result, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);
        using var request = new HttpRequestMessage(HttpMethod.Get, result.Url);
        request.Headers.UserAgent.ParseAdd("AiSummarizer/1.0");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "text/html";
        var metadata = JsonSerializer.Serialize(new
        {
            statusCode = (int)response.StatusCode,
            finalUrl = response.RequestMessage?.RequestUri?.ToString(),
            contentType,
            title = result.Title
        });

        if (!response.IsSuccessStatusCode)
        {
            return new FetchedContent(
                NormalizeTitle(result.Title, null),
                NormalizeUrl(response.RequestMessage?.RequestUri?.ToString() ?? result.Url),
                null,
                null,
                "http_fetch",
                contentType,
                NormalizeText(body),
                null,
                metadata,
                ComputeHash(body));
        }

        var title = ExtractTitle(body) ?? result.Title;
        var rawText = contentType.Contains("html", StringComparison.OrdinalIgnoreCase)
            ? NormalizeText(HtmlToText(body))
            : NormalizeText(body);

        return new FetchedContent(
            NormalizeTitle(title, result.Title),
            NormalizeUrl(response.RequestMessage?.RequestUri?.ToString() ?? result.Url),
            null,
            null,
            "http_fetch",
            contentType,
            rawText,
            null,
            metadata,
            ComputeHash(rawText));
    }

    private async Task<FetchedContent> FetchYouTubeAsync(ResearchSearchResultDto result, CancellationToken cancellationToken)
    {
        var youtube = youtubeOptions.Value;
        var attemptDirectory = Path.Combine(Path.GetTempPath(), "ai-summarizer-research", "youtube", result.Id.ToString("N"));
        Directory.CreateDirectory(attemptDirectory);

        var metadata = await FetchYouTubeMetadataAsync(youtube.YtDlpExecutable, result.Url, cancellationToken);
        var title = NormalizeTitle(metadata.Title ?? result.Title, result.Title);

        var subtitleResult = await RunProcessAsync(
            youtube.YtDlpExecutable,
            new[]
            {
                "--skip-download",
                "--write-subs",
                "--write-auto-subs",
                "--sub-langs", "all",
                "--sub-format", "vtt",
                "-o", Path.Combine(attemptDirectory, "%(id)s.%(ext)s"),
                "--",
                result.Url
            },
            attemptDirectory,
            cancellationToken);

        if (subtitleResult.ExitCode != 0)
        {
            throw new InvalidOperationException(string.Join(Environment.NewLine, subtitleResult.ErrorLines));
        }

        var subtitleFile = Directory.GetFiles(attemptDirectory, "*.vtt", SearchOption.AllDirectories)
            .Concat(Directory.GetFiles(attemptDirectory, "*.srt", SearchOption.AllDirectories))
            .FirstOrDefault();

        if (subtitleFile is null)
        {
            throw new InvalidOperationException("YouTube subtitles were not found.");
        }

        var segments = ParseSubtitleFile(subtitleFile);
        if (segments.Count == 0)
        {
            throw new InvalidOperationException("YouTube subtitles were empty.");
        }

        var transcript = string.Join(Environment.NewLine, segments.Select(segment => segment.Text));
        var transcriptFilePath = Path.Combine(attemptDirectory, $"{result.Id:N}.json");
        var transcriptJson = JsonSerializer.Serialize(new
        {
            language = InferLanguageFromFileName(subtitleFile) ?? "en",
            languageProbability = 1.0,
            duration = segments.Count == 0 ? 0 : segments[^1].End,
            segments = segments.Select(segment => new
            {
                start = Math.Round(segment.Start, 2),
                end = Math.Round(segment.End, 2),
                text = segment.Text
            })
        }, new JsonSerializerOptions { WriteIndented = true });

        await File.WriteAllTextAsync(transcriptFilePath, transcriptJson, cancellationToken);

        return new FetchedContent(
            title,
            result.Url,
            metadata.AuthorName,
            metadata.UploadDateUnix is null ? null : DateTimeOffset.FromUnixTimeSeconds(metadata.UploadDateUnix.Value),
            "youtube_transcript",
            "application/json",
            transcript,
            transcriptFilePath,
            JsonSerializer.Serialize(new
            {
                metadata.Id,
                metadata.Title,
                metadata.DurationSeconds,
                metadata.AuthorName,
                subtitleFile,
                transcriptFilePath
            }),
            ComputeHash(transcript));
    }

    private static async Task<YouTubeMetadata> FetchYouTubeMetadataAsync(string executable, string url, CancellationToken cancellationToken)
    {
        var result = await RunProcessAsync(
            executable,
            new[]
            {
                "--no-playlist",
                "--dump-single-json",
                "--",
                url
            },
            null,
            cancellationToken);

        if (result.ExitCode != 0)
        {
            var error = string.Join(Environment.NewLine, result.ErrorLines);
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(error) ? "Failed to fetch YouTube metadata." : error);
        }

        var json = string.Join(Environment.NewLine, result.OutputLines);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        return new YouTubeMetadata(
            root.TryGetProperty("id", out var idProperty) ? idProperty.GetString() : null,
            root.TryGetProperty("title", out var titleProperty) ? titleProperty.GetString() : null,
            root.TryGetProperty("duration", out var durationProperty) && durationProperty.TryGetInt32(out var duration) ? duration : null,
            root.TryGetProperty("uploader", out var uploaderProperty) ? uploaderProperty.GetString() : null,
            root.TryGetProperty("upload_date", out var uploadDateProperty) && DateTime.TryParseExact(uploadDateProperty.GetString(), "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var uploadDate)
                ? new DateTimeOffset(uploadDate, TimeSpan.Zero).ToUnixTimeSeconds()
                : null);
    }

    private static List<SubtitleSegment> ParseSubtitleFile(string subtitleFilePath)
    {
        var lines = File.ReadAllLines(subtitleFilePath);
        var segments = new List<SubtitleSegment>();

        var i = 0;
        while (i < lines.Length)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line) || line.Equals("WEBVTT", StringComparison.OrdinalIgnoreCase))
            {
                i++;
                continue;
            }

            if (line.Contains("-->", StringComparison.Ordinal))
            {
                var match = VttTimestampRegex.Match(line);
                if (match.Success)
                {
                    var start = ParseTimestamp(match.Groups["start"].Value);
                    var end = ParseTimestamp(match.Groups["end"].Value);
                    i++;
                    var text = new StringBuilder();
                    while (i < lines.Length && !string.IsNullOrWhiteSpace(lines[i]))
                    {
                        if (text.Length > 0)
                        {
                            text.Append(' ');
                        }

                        text.Append(lines[i].Trim());
                        i++;
                    }

                    var normalizedText = text.ToString().Trim();
                    if (!string.IsNullOrWhiteSpace(normalizedText))
                    {
                        segments.Add(new SubtitleSegment(start, end, normalizedText));
                    }

                    continue;
                }
            }

            i++;
        }

        return segments;
    }

    private static double ParseTimestamp(string timestamp)
    {
        var normalized = timestamp.Replace(',', '.');
        var parts = normalized.Split(':', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 3 &&
            int.TryParse(parts[0], out var hours) &&
            int.TryParse(parts[1], out var minutes) &&
            double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds))
        {
            return (hours * 3600) + (minutes * 60) + seconds;
        }

        return 0;
    }

    private static async Task<ProcessResult> RunProcessAsync(
        string executable,
        IEnumerable<string> arguments,
        string? workingDirectory,
        CancellationToken cancellationToken)
    {
        var outputLines = new List<string>();
        var errorLines = new List<string>();
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = executable,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            },
            EnableRaisingEvents = true
        };

        foreach (var argument in arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                outputLines.Add(e.Data);
            }
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                errorLines.Add(e.Data);
            }
        };

        using var registration = cancellationToken.Register(() =>
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // best effort
            }
        });

        if (!process.Start())
        {
            throw new InvalidOperationException($"Failed to start process: {executable}");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync(cancellationToken);
        process.WaitForExit();
        return new ProcessResult(process.ExitCode, outputLines, errorLines);
    }

    private static string? ExtractTitle(string html)
        => TitleRegex.Match(html) is { Success: true } match ? WebUtility.HtmlDecode(match.Groups["title"].Value).Trim() : null;

    private static string HtmlToText(string html)
    {
        var withoutScripts = ScriptStyleRegex.Replace(html, " ");
        var withoutTags = TagRegex.Replace(withoutScripts, " ");
        return WebUtility.HtmlDecode(withoutTags);
    }

    private static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var collapsed = Regex.Replace(value, @"\s+", " ");
        return collapsed.Trim();
    }

    private static string NormalizeTitle(string? primary, string? fallback)
        => NormalizeText(primary) is { Length: > 0 } title ? title : NormalizeText(fallback);

    private static string NormalizeUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var parsed) ? parsed.ToString() : url.Trim();

    private static bool IsYouTubeUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var parsed) &&
           (parsed.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
            parsed.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase));

    private static string ComputeHash(string text)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text ?? string.Empty)));

    private static string? InferLanguageFromFileName(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        var parts = name.Split('.');
        return parts.Length > 1 ? parts[^1] : null;
    }

    private static ResearchTopicFetchPayload? ParsePayload(JsonElement payload)
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

        return new ResearchTopicFetchPayload(researchTopicId, researchTopicRunId, requestedByUserId, string.IsNullOrWhiteSpace(triggeredBy) ? "api" : triggeredBy.Trim());
    }

    private sealed record ResearchTopicFetchPayload(Guid ResearchTopicId, Guid ResearchTopicRunId, Guid? RequestedByUserId, string TriggeredBy);
    private sealed record SubtitleSegment(double Start, double End, string Text);
    private sealed record YouTubeMetadata(string? Id, string? Title, int? DurationSeconds, string? AuthorName, long? UploadDateUnix);
    private sealed record ProcessResult(int ExitCode, IReadOnlyList<string> OutputLines, IReadOnlyList<string> ErrorLines);
    private sealed record FetchedContent(string? Title, string? CanonicalUrl, string? AuthorName, DateTimeOffset? PublishedAt, string FetchMethod, string ContentType, string RawText, string? RawStoragePath, string RawMetadataJson, string ContentHash);
}
