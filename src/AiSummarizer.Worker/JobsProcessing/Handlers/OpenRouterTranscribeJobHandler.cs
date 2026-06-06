using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class OpenRouterTranscribeJobHandler(
    IHttpClientFactory httpClientFactory,
    IOptions<OpenRouterTranscribeOptions> options,
    ILogger<OpenRouterTranscribeJobHandler> logger) : IJobHandler
{
    public string JobType => "openrouter.transcribe";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "OpenRouter transcribe job payload is missing the source file path.", null);
        }

        if (!File.Exists(payload.SourceFilePath))
        {
            return JobHandlerResult.DeadLetter(
                "source_file_missing",
                $"Source audio file was not found: {payload.SourceFilePath}",
                JsonSerializer.SerializeToElement(new { sourceFilePath = payload.SourceFilePath }));
        }

        var workerOptions = options.Value;
        var maxAttempts = Math.Max(1, workerOptions.MaxAttempts);
        if (string.IsNullOrWhiteSpace(payload.OutputDirectory))
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "OpenRouter transcribe job payload must include outputDirectory.", null);
        }

        var apiKey = workerOptions.ApiKey.Trim();
        if (apiKey.Length == 0)
        {
            return JobHandlerResult.DeadLetter("missing_api_key", "OpenRouter transcription API key is missing.", null);
        }

        var outputRoot = NormalizePath(payload.OutputDirectory);
        Directory.CreateDirectory(outputRoot);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var attemptDirectory = Path.Combine(outputRoot, context.Job.Id.ToString("N"));
                Directory.CreateDirectory(attemptDirectory);

                var transcriptFilePath = Path.Combine(attemptDirectory, $"{SanitizeFileName(Path.GetFileNameWithoutExtension(payload.SourceFilePath), context.Job.Id.ToString("N"))}.json");

                await context.LogInfoAsync("Starting OpenRouter transcription", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    sourceFilePath = payload.SourceFilePath,
                    transcriptFilePath,
                    baseUrl = workerOptions.BaseUrl,
                    model = workerOptions.Model
                }), cancellationToken);

                context.ReportProgress(5, "Uploading audio to OpenRouter");

                var transcriptJson = await TranscribeAsync(
                    workerOptions.BaseUrl,
                    workerOptions.TranscribePath,
                    workerOptions.Model,
                    apiKey,
                    payload.SourceFilePath,
                    payload.Language ?? workerOptions.Language,
                    workerOptions.RequestTimeoutSeconds,
                    percent =>
                    {
                        var scaled = (short)Math.Clamp(5 + (percent * 0.85), 5, 95);
                        context.ReportProgress(scaled, $"Transcribing audio: {percent:0}%");
                    },
                    cancellationToken);

                await File.WriteAllTextAsync(transcriptFilePath, transcriptJson, cancellationToken);

                using var document = JsonDocument.Parse(transcriptJson);
                var root = document.RootElement;
                var language = root.TryGetProperty("language", out var languageProperty) ? languageProperty.GetString() : null;
                var languageProbability = root.TryGetProperty("languageProbability", out var languageProbabilityProperty) && languageProbabilityProperty.TryGetDouble(out var lp) ? lp : (double?)null;
                var duration = root.TryGetProperty("duration", out var durationProperty) && durationProperty.TryGetDouble(out var durationValue) ? durationValue : (double?)null;
                var segmentsCount = root.TryGetProperty("segments", out var segmentsProperty) && segmentsProperty.ValueKind == JsonValueKind.Array ? segmentsProperty.GetArrayLength() : 0;

                context.ReportProgress(100, "Completed");
                await context.LogInfoAsync("OpenRouter transcription completed", JsonSerializer.SerializeToElement(new
                {
                    sourceFilePath = payload.SourceFilePath,
                    transcriptFilePath,
                    language,
                    languageProbability,
                    duration,
                    segmentsCount
                }), cancellationToken);

                return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
                {
                    sourceFilePath = payload.SourceFilePath,
                    transcriptFilePath,
                    outputDirectory = attemptDirectory,
                    language,
                    languageProbability,
                    duration,
                    segmentsCount
                }));
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "OpenRouter transcription attempt {Attempt} failed", attempt);
                if (attempt >= maxAttempts)
                {
                    return JobHandlerResult.DeadLetter(
                        "openrouter_transcription_failed",
                        ex.Message,
                        JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exception = ex.GetType().FullName,
                            stackTrace = ex.StackTrace
                        }));
                }

                await context.LogWarningAsync("OpenRouter transcription attempt failed; retrying", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    exception = ex.GetType().FullName,
                    message = ex.Message
                }), cancellationToken);

                return JobHandlerResult.Retry(
                    "openrouter_transcription_retryable",
                    ex.Message,
                    JsonSerializer.SerializeToElement(new
                    {
                        attempt,
                        exception = ex.GetType().FullName,
                        stackTrace = ex.StackTrace
                    }),
                    workerOptions.RetryDelay);
            }
        }

        return JobHandlerResult.DeadLetter("openrouter_transcription_failed", "OpenRouter transcription failed after all attempts.", null);
    }

    private async Task<string> TranscribeAsync(
        string baseUrl,
        string transcribePath,
        string model,
        string apiKey,
        string sourceFilePath,
        string? language,
        int timeoutSeconds,
        Action<double> onProgress,
        CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = Timeout.InfiniteTimeSpan;
        client.BaseAddress = NormalizeBaseUri(baseUrl);

        await using var fileStream = File.OpenRead(sourceFilePath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(GetContentType(sourceFilePath));

        using var multipart = new MultipartFormDataContent();
        multipart.Add(fileContent, "file", Path.GetFileName(sourceFilePath));
        multipart.Add(new StringContent(model), "model");
        if (!string.IsNullOrWhiteSpace(language))
        {
            multipart.Add(new StringContent(language), "language");
        }

        onProgress(15);

        using var request = new HttpRequestMessage(HttpMethod.Post, transcribePath)
        {
            Content = multipart
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Headers.Accept.ParseAdd("application/json");

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, timeoutSeconds)));

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
        var responseBody = await response.Content.ReadAsStringAsync(timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            throw new OpenRouterTranscribeServiceException(response.StatusCode, responseBody);
        }

        onProgress(95);
        return responseBody;
    }

    private static Uri NormalizeBaseUri(string baseUrl)
    {
        var normalized = baseUrl.Trim();
        if (!normalized.EndsWith('/'))
        {
            normalized += "/";
        }

        return new Uri(normalized, UriKind.Absolute);
    }

    private static string GetContentType(string filePath)
    {
        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" => "audio/mp4",
            ".mp4" => "video/mp4",
            ".wav" => "audio/wav",
            ".ogg" => "audio/ogg",
            _ => "application/octet-stream"
        };
    }

    private sealed record OpenRouterTranscribePayload(string SourceFilePath, string OutputDirectory, string? Language);

    private static OpenRouterTranscribePayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        string? sourceFilePath = null;
        string? outputDirectory = null;
        string? language = null;

        if (payload.TryGetProperty("sourceFilePath", out var sourceFilePathProperty))
        {
            sourceFilePath = sourceFilePathProperty.GetString();
        }
        else if (payload.TryGetProperty("inputFilePath", out var inputFilePathProperty))
        {
            sourceFilePath = inputFilePathProperty.GetString();
        }

        if (payload.TryGetProperty("outputDirectory", out var outputDirectoryProperty))
        {
            outputDirectory = outputDirectoryProperty.GetString();
        }

        if (payload.TryGetProperty("language", out var languageProperty))
        {
            language = languageProperty.GetString();
        }

        if (string.IsNullOrWhiteSpace(sourceFilePath))
        {
            return null;
        }

        return new OpenRouterTranscribePayload(sourceFilePath.Trim(), outputDirectory?.Trim() ?? string.Empty, NormalizeNullable(language));
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path);
    private static string SanitizeFileName(string value, string fallback)
    {
        var sanitized = Regex.Replace(value, @"[^\w\-]+", "_").Trim('_');
        return string.IsNullOrWhiteSpace(sanitized) ? fallback : sanitized;
    }
    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class OpenRouterTranscribeServiceException(HttpStatusCode statusCode, string responseBody)
    : Exception($"OpenRouter transcription service returned {(int)statusCode} ({statusCode}).")
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public string ResponseBody { get; } = responseBody;
}
