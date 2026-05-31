using System.Net.Http.Headers;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class WhisperTranscribeJobHandler(
    IHttpClientFactory httpClientFactory,
    IOptions<WhisperTranscribeOptions> options,
    ILogger<WhisperTranscribeJobHandler> logger) : IJobHandler
{
    public string JobType => "whisper.transcribe";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Whisper transcribe job payload is missing the source file path.", null);
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
            return JobHandlerResult.DeadLetter("invalid_payload", "Whisper transcribe job payload must include outputDirectory.", null);
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

                await context.LogInfoAsync("Starting Whisper transcription", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    sourceFilePath = payload.SourceFilePath,
                    transcriptFilePath,
                    whisperServiceBaseUrl = workerOptions.WhisperServiceBaseUrl
                }), cancellationToken);

                context.ReportProgress(5, "Uploading audio to Whisper");

                var transcriptJson = await TranscribeAsync(
                    workerOptions.WhisperServiceBaseUrl,
                    workerOptions.TranscribePath,
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
                await context.LogInfoAsync("Whisper transcription completed", JsonSerializer.SerializeToElement(new
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
                logger.LogWarning(ex, "Whisper transcription attempt {Attempt} failed", attempt);
                if (ex is WhisperServiceException serviceEx)
                {
                    var statusCode = serviceEx.StatusCode;
                    if (statusCode >= HttpStatusCode.BadRequest &&
                        statusCode < HttpStatusCode.InternalServerError &&
                        statusCode != HttpStatusCode.RequestTimeout &&
                        statusCode != HttpStatusCode.TooManyRequests)
                    {
                        return JobHandlerResult.DeadLetter(
                            "whisper_transcription_failed",
                            serviceEx.Message,
                            JsonSerializer.SerializeToElement(new
                            {
                                attempt,
                                statusCode = (int)serviceEx.StatusCode,
                                serviceError = serviceEx.ResponseBody,
                                exception = ex.GetType().FullName
                            }));
                    }
                }

                if (attempt >= maxAttempts)
                {
                    return JobHandlerResult.DeadLetter(
                        "whisper_transcription_failed",
                        ex.Message,
                        JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exception = ex.GetType().FullName,
                            stackTrace = ex.StackTrace
                        }));
                }

                await context.LogWarningAsync("Whisper transcription attempt failed; retrying", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    exception = ex.GetType().FullName,
                    message = ex.Message
                }), cancellationToken);

                return JobHandlerResult.Retry(
                    "whisper_transcription_retryable",
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

        return JobHandlerResult.DeadLetter("whisper_transcription_failed", "Whisper transcription failed after all attempts.", null);
    }

    private async Task<string> TranscribeAsync(
        string baseUrl,
        string transcribePath,
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
        if (!string.IsNullOrWhiteSpace(language))
        {
            multipart.Add(new StringContent(language), "language");
        }

        onProgress(15);

        using var request = new HttpRequestMessage(HttpMethod.Post, transcribePath)
        {
            Content = multipart
        };

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, timeoutSeconds)));

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
        var responseBody = await response.Content.ReadAsStringAsync(timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            throw new WhisperServiceException(response.StatusCode, responseBody);
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

    private sealed record WhisperTranscribePayload(string SourceFilePath, string OutputDirectory, string? Language);

    private static WhisperTranscribePayload? ParsePayload(JsonElement payload)
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
        else if (payload.TryGetProperty("sourceLanguage", out var sourceLanguageProperty))
        {
            language = sourceLanguageProperty.GetString();
        }

        if (string.IsNullOrWhiteSpace(sourceFilePath))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(outputDirectory))
        {
            return null;
        }

        return new WhisperTranscribePayload(sourceFilePath.Trim(), outputDirectory.Trim(), language?.Trim());
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path);

    private static string SanitizeFileName(string name, string fallback)
    {
        var sanitized = name;
        foreach (var c in Path.GetInvalidFileNameChars())
        {
            sanitized = sanitized.Replace(c, '_');
        }

        sanitized = Regex.Replace(sanitized, @"[#""'*\[\]]", "");
        sanitized = sanitized.Trim().Trim('"', '\'', ' ');

        if (string.IsNullOrWhiteSpace(sanitized))
        {
            sanitized = $"transcript_{fallback}";
        }

        const int maxLength = 200;
        if (sanitized.Length > maxLength)
        {
            sanitized = sanitized[..maxLength];
        }

        return sanitized;
    }

    private sealed class WhisperServiceException(HttpStatusCode statusCode, string responseBody)
        : InvalidOperationException($"Whisper service returned {(int)statusCode} {statusCode}: {responseBody}")
    {
        public HttpStatusCode StatusCode { get; } = statusCode;
        public string ResponseBody { get; } = responseBody;
    }
}
