using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class YouTubeDownloadJobHandler(
    IOptions<YouTubeDownloadOptions> options,
    ILogger<YouTubeDownloadJobHandler> logger) : IJobHandler
{
    private static readonly Regex ProgressRegex = new(@"(\d+(?:\.\d+)?)%", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string JobType => "youtube.download";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "YouTube download job payload is missing the URL.", null);
        }

        var workerOptions = options.Value;
        var maxAttempts = Math.Max(1, workerOptions.MaxAttempts);
        var outputRoot = NormalizePath(string.IsNullOrWhiteSpace(payload.OutputDirectory) ? workerOptions.OutputDirectory : payload.OutputDirectory);

        Directory.CreateDirectory(outputRoot);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var attemptDirectory = Path.Combine(outputRoot, context.Job.Id.ToString("N"));
                Directory.CreateDirectory(attemptDirectory);

                await context.LogInfoAsync($"Resolving YouTube metadata (attempt {attempt}/{maxAttempts})", null, cancellationToken);
                context.ReportProgress(5, "Fetching video metadata");
                var metadata = await FetchMetadataAsync(workerOptions.YtDlpExecutable, payload.Url, cancellationToken);

                var title = metadata.Title ?? payload.CustomFileName ?? $"video_{metadata.Id ?? context.Job.Id.ToString("N")}";
                var baseFileName = SanitizeFileName(payload.CustomFileName ?? title, metadata.Id ?? context.Job.Id.ToString("N"));
                var finalFilePath = Path.Combine(attemptDirectory, $"{baseFileName}.mp4");
                var template = Path.Combine(attemptDirectory, $"{baseFileName}.%(ext)s");

                await context.LogInfoAsync($"Downloading {title}", JsonSerializer.SerializeToElement(new
                {
                    title,
                    videoId = metadata.Id,
                    durationSeconds = metadata.DurationSeconds
                }), cancellationToken);

                context.ReportProgress(10, "Downloading video");
                var download = await RunDownloadAsync(
                    workerOptions.YtDlpExecutable,
                    payload.Url,
                    template,
                    attemptDirectory,
                    percent =>
                    {
                        var scaled = (short)Math.Clamp(10 + (percent * 0.80), 10, 90);
                        context.ReportProgress(scaled, $"Downloading: {percent:0}%");
                    },
                    cancellationToken);

                if (download.ExitCode != 0)
                {
                    var errorText = string.Join(Environment.NewLine, download.ErrorLines);
                    if (IsFatalError(errorText))
                    {
                        await context.LogErrorAsync("YouTube download failed with a fatal error", JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exitCode = download.ExitCode,
                            error = errorText
                        }), cancellationToken);

                        return JobHandlerResult.DeadLetter("youtube_download_failed", "YouTube download failed.", JsonSerializer.SerializeToElement(new
                        {
                            exitCode = download.ExitCode,
                            error = errorText
                        }));
                    }

                    if (attempt < maxAttempts)
                    {
                        await context.LogWarningAsync("YouTube download failed; retrying", JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exitCode = download.ExitCode,
                            error = errorText
                        }), cancellationToken);

                        return JobHandlerResult.Retry(
                            "youtube_download_retryable",
                            "YouTube download failed; retrying.",
                            JsonSerializer.SerializeToElement(new
                            {
                                exitCode = download.ExitCode,
                                error = errorText
                            }),
                            workerOptions.RetryDelay);
                    }

                    return JobHandlerResult.DeadLetter("youtube_download_failed", "YouTube download failed.", JsonSerializer.SerializeToElement(new
                    {
                        exitCode = download.ExitCode,
                        error = errorText
                    }));
                }

                if (!File.Exists(finalFilePath))
                {
                    var found = Directory.GetFiles(attemptDirectory, $"{baseFileName}.*")
                        .FirstOrDefault(path => !path.EndsWith(".part", StringComparison.OrdinalIgnoreCase));

                    if (found is null || !File.Exists(found))
                    {
                        return JobHandlerResult.DeadLetter("youtube_output_missing", "The downloaded output file was not found.", JsonSerializer.SerializeToElement(new
                        {
                            expectedPath = finalFilePath,
                            attemptDirectory
                        }));
                    }

                    finalFilePath = found;
                }

                context.ReportProgress(100, "Completed");
                await context.LogInfoAsync("YouTube download completed", JsonSerializer.SerializeToElement(new
                {
                    outputFilePath = finalFilePath,
                    title,
                    videoId = metadata.Id,
                    durationSeconds = metadata.DurationSeconds
                }), cancellationToken);

                return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
                {
                    sourceUrl = payload.Url,
                    videoId = metadata.Id,
                    title,
                    durationSeconds = metadata.DurationSeconds,
                    outputDirectory = attemptDirectory,
                    outputFilePath = finalFilePath
                }));
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "YouTube download attempt {Attempt} failed", attempt);
                if (attempt >= maxAttempts)
                {
                    return JobHandlerResult.DeadLetter("youtube_download_failed", ex.Message, JsonSerializer.SerializeToElement(new
                    {
                        attempt,
                        exception = ex.GetType().FullName,
                        stackTrace = ex.StackTrace
                    }));
                }

                await context.LogWarningAsync("YouTube download attempt failed; retrying", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    exception = ex.GetType().FullName,
                    message = ex.Message
                }), cancellationToken);

                return JobHandlerResult.Retry(
                    "youtube_download_retryable",
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

        return JobHandlerResult.DeadLetter("youtube_download_failed", "YouTube download failed after all attempts.", null);
    }

    private static async Task<YouTubeMetadata> FetchMetadataAsync(string executable, string url, CancellationToken cancellationToken)
    {
        var result = await RunProcessAsync(
            executable,
            new[]
            {
                "--no-playlist",
                "--dump-single-json",
                url
            },
            workingDirectory: null,
            onStdOutLine: null,
            onStdErrLine: null,
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
            root.TryGetProperty("duration", out var durationProperty) && durationProperty.TryGetInt32(out var duration) ? duration : null);
    }

    private static async Task<ProcessResult> RunDownloadAsync(
        string executable,
        string url,
        string outputTemplate,
        string workingDirectory,
        Action<double> onProgress,
        CancellationToken cancellationToken)
    {
        var args = new[]
        {
            "-o", outputTemplate,
            "-f", "bestvideo+bestaudio",
            "--merge-output-format", "mp4",
            "--newline",
            "--progress",
            "--force-overwrite",
            "--no-playlist",
            url
        };

        return await RunProcessAsync(
            executable,
            args,
            workingDirectory,
            onStdOutLine: null,
            onStdErrLine: line =>
            {
                if (line.Contains("[download]", StringComparison.OrdinalIgnoreCase))
                {
                    var match = ProgressRegex.Match(line);
                    if (match.Success && double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var percent))
                    {
                        onProgress(percent);
                    }
                }
            },
            cancellationToken);
    }

    private static async Task<ProcessResult> RunProcessAsync(
        string executable,
        IEnumerable<string> arguments,
        string? workingDirectory,
        Action<string>? onStdOutLine,
        Action<string>? onStdErrLine,
        CancellationToken cancellationToken)
    {
        var outputLines = new List<string>();
        var errorLines = new List<string>();
        var process = new Process
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
            if (e.Data is null)
            {
                return;
            }

            outputLines.Add(e.Data);
            onStdOutLine?.Invoke(e.Data);
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                return;
            }

            errorLines.Add(e.Data);
            onStdErrLine?.Invoke(e.Data);
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

    private static YouTubeDownloadPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        string? url = null;
        string? customFileName = null;
        string? outputDirectory = null;

        if (payload.TryGetProperty("videoUrl", out var videoUrlProperty))
        {
            url = videoUrlProperty.GetString();
        }
        else if (payload.TryGetProperty("youtubeUrl", out var youtubeUrlProperty))
        {
            url = youtubeUrlProperty.GetString();
        }
        else if (payload.TryGetProperty("url", out var urlProperty))
        {
            url = urlProperty.GetString();
        }

        if (payload.TryGetProperty("customFileName", out var customFileNameProperty))
        {
            customFileName = customFileNameProperty.GetString();
        }

        if (payload.TryGetProperty("outputDirectory", out var outputDirectoryProperty))
        {
            outputDirectory = outputDirectoryProperty.GetString();
        }

        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        return new YouTubeDownloadPayload(url.Trim(), customFileName, outputDirectory);
    }

    private static bool IsFatalError(string error)
    {
        var normalized = error.ToLowerInvariant();
        return normalized.Contains("unsupported url") ||
               normalized.Contains("video unavailable") ||
               normalized.Contains("private video") ||
               normalized.Contains("sign in to confirm your age") ||
               normalized.Contains("this video is unavailable") ||
               normalized.Contains("members-only") ||
               normalized.Contains("paid content");
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path);

    private static string SanitizeFileName(string name, string videoId)
    {
        var sanitized = name;
        foreach (var c in Path.GetInvalidFileNameChars())
        {
            sanitized = sanitized.Replace(c, '_');
        }

        sanitized = Regex.Replace(sanitized, @"[#""'*\[\]]", "");
        sanitized = sanitized.Trim().Trim('"', '\'', ' ');

        if (string.IsNullOrWhiteSpace(sanitized) || sanitized.Length < 3)
        {
            sanitized = $"video_{videoId}";
        }

        const int maxLength = 200;
        if (sanitized.Length > maxLength)
        {
            sanitized = sanitized[..maxLength];
        }

        return sanitized;
    }

    private sealed record YouTubeDownloadPayload(string Url, string? CustomFileName, string? OutputDirectory);

    private sealed record YouTubeMetadata(string? Id, string? Title, int? DurationSeconds);

    private sealed record ProcessResult(int ExitCode, IReadOnlyList<string> OutputLines, IReadOnlyList<string> ErrorLines);
}
