using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class MediaExtractAudioJobHandler(
    IOptions<MediaExtractAudioOptions> options,
    ILogger<MediaExtractAudioJobHandler> logger) : IJobHandler
{
    private static readonly Regex TimeRegex = new(@"time=(\d+):(\d+):(\d+(?:\.\d+)?)", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string JobType => "media.extract_audio";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Media extract audio job payload is missing the source file path.", null);
        }

        if (!File.Exists(payload.SourceFilePath))
        {
            return JobHandlerResult.DeadLetter(
                "source_file_missing",
                $"Source file was not found: {payload.SourceFilePath}",
                JsonSerializer.SerializeToElement(new { sourceFilePath = payload.SourceFilePath }));
        }

        var workerOptions = options.Value;
        var maxAttempts = Math.Max(1, workerOptions.MaxAttempts);
        if (string.IsNullOrWhiteSpace(payload.OutputDirectory))
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Media extract audio job payload must include outputDirectory.", null);
        }

        var outputRoot = NormalizePath(payload.OutputDirectory);
        var audioFormat = NormalizeAudioFormat(string.IsNullOrWhiteSpace(payload.AudioFormat) ? workerOptions.DefaultAudioFormat : payload.AudioFormat);

        Directory.CreateDirectory(outputRoot);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var attemptDirectory = Path.Combine(outputRoot, context.Job.Id.ToString("N"));
                Directory.CreateDirectory(attemptDirectory);

                var sourceFileName = Path.GetFileNameWithoutExtension(payload.SourceFilePath);
                var baseFileName = SanitizeFileName(string.IsNullOrWhiteSpace(payload.CustomFileName) ? sourceFileName : payload.CustomFileName, context.Job.Id.ToString("N"));
                var outputFilePath = Path.Combine(attemptDirectory, $"{baseFileName}.{audioFormat}");

                await context.LogInfoAsync("Starting audio extraction", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    sourceFilePath = payload.SourceFilePath,
                    outputFilePath,
                    audioFormat
                }), cancellationToken);

                context.ReportProgress(5, "Preparing audio extraction");

                var result = await RunFfmpegAsync(
                    workerOptions.FfmpegExecutable,
                    payload.SourceFilePath,
                    outputFilePath,
                    audioFormat,
                    workerOptions.AudioBitrateKbps,
                    percent =>
                    {
                        var scaled = (short)Math.Clamp(5 + (percent * 0.90), 5, 95);
                        context.ReportProgress(scaled, $"Extracting audio: {percent:0}%");
                    },
                    cancellationToken);

                if (result.ExitCode != 0)
                {
                    var errorText = string.Join(Environment.NewLine, result.ErrorLines);
                    await context.LogWarningAsync("Audio extraction failed; retrying or dead-lettering", JsonSerializer.SerializeToElement(new
                    {
                        attempt,
                        exitCode = result.ExitCode,
                        error = errorText
                    }), cancellationToken);

                    if (attempt < maxAttempts)
                    {
                        return JobHandlerResult.Retry(
                            "audio_extraction_retryable",
                            "Audio extraction failed; retrying.",
                            JsonSerializer.SerializeToElement(new
                            {
                                attempt,
                                exitCode = result.ExitCode,
                                error = errorText
                            }),
                            workerOptions.RetryDelay);
                    }

                    return JobHandlerResult.DeadLetter(
                        "audio_extraction_failed",
                        "Audio extraction failed.",
                        JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exitCode = result.ExitCode,
                            error = errorText
                        }));
                }

                if (!File.Exists(outputFilePath))
                {
                    var found = Directory.GetFiles(attemptDirectory, $"{baseFileName}.*")
                        .FirstOrDefault(path => !path.EndsWith(".part", StringComparison.OrdinalIgnoreCase));

                    if (found is null || !File.Exists(found))
                    {
                        return JobHandlerResult.DeadLetter(
                            "audio_output_missing",
                            "The extracted audio file was not found.",
                            JsonSerializer.SerializeToElement(new
                            {
                                expectedPath = outputFilePath,
                                attemptDirectory
                            }));
                    }

                    outputFilePath = found;
                }

                context.ReportProgress(100, "Completed");
                await context.LogInfoAsync("Audio extraction completed", JsonSerializer.SerializeToElement(new
                {
                    sourceFilePath = payload.SourceFilePath,
                    outputFilePath,
                    audioFormat
                }), cancellationToken);

                return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
                {
                    sourceFilePath = payload.SourceFilePath,
                    outputDirectory = attemptDirectory,
                    outputFilePath,
                    audioFormat
                }));
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Audio extraction attempt {Attempt} failed", attempt);
                if (attempt >= maxAttempts)
                {
                    return JobHandlerResult.DeadLetter(
                        "audio_extraction_failed",
                        ex.Message,
                        JsonSerializer.SerializeToElement(new
                        {
                            attempt,
                            exception = ex.GetType().FullName,
                            stackTrace = ex.StackTrace
                        }));
                }

                await context.LogWarningAsync("Audio extraction attempt failed; retrying", JsonSerializer.SerializeToElement(new
                {
                    attempt,
                    exception = ex.GetType().FullName,
                    message = ex.Message
                }), cancellationToken);

                return JobHandlerResult.Retry(
                    "audio_extraction_retryable",
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

        return JobHandlerResult.DeadLetter("audio_extraction_failed", "Audio extraction failed after all attempts.", null);
    }

    private static async Task<ProcessResult> RunFfmpegAsync(
        string executable,
        string sourceFilePath,
        string outputFilePath,
        string audioFormat,
        int audioBitrateKbps,
        Action<double> onProgress,
        CancellationToken cancellationToken)
    {
        var args = new List<string>
        {
            "-hide_banner",
            "-y",
            "-i", sourceFilePath,
            "-vn"
        };

        switch (audioFormat)
        {
            case "mp3":
                args.AddRange(["-c:a", "libmp3lame", "-b:a", $"{audioBitrateKbps}k"]);
                break;
            case "wav":
                args.AddRange(["-c:a", "pcm_s16le"]);
                break;
            case "m4a":
            default:
                args.AddRange(["-c:a", "aac", "-b:a", $"{audioBitrateKbps}k"]);
                break;
        }

        args.Add(outputFilePath);

        return await RunProcessAsync(
            executable,
            args,
            workingDirectory: null,
            onStdOutLine: null,
            onStdErrLine: line =>
            {
                if (line.Contains("time=", StringComparison.OrdinalIgnoreCase))
                {
                    var match = TimeRegex.Match(line);
                    if (match.Success && TryParsePercent(match, out var percent))
                    {
                        onProgress(percent);
                    }
                }
            },
            cancellationToken);
    }

    private static bool TryParsePercent(Match match, out double percent)
    {
        percent = 0;

        if (!TimeSpan.TryParse($"{match.Groups[1].Value}:{match.Groups[2].Value}:{match.Groups[3].Value}", out var elapsed))
        {
            return false;
        }

        percent = Math.Min(99, Math.Max(0, elapsed.TotalSeconds % 100));
        return true;
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
                WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory
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

    private sealed record ProcessResult(int ExitCode, IReadOnlyList<string> OutputLines, IReadOnlyList<string> ErrorLines);

    private sealed record MediaExtractAudioPayload(string SourceFilePath, string OutputDirectory, string? AudioFormat, string? CustomFileName);

    private static MediaExtractAudioPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        string? sourceFilePath = null;
        string? outputDirectory = null;
        string? audioFormat = null;
        string? customFileName = null;

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

        if (payload.TryGetProperty("audioFormat", out var audioFormatProperty))
        {
            audioFormat = audioFormatProperty.GetString();
        }

        if (payload.TryGetProperty("customFileName", out var customFileNameProperty))
        {
            customFileName = customFileNameProperty.GetString();
        }

        if (string.IsNullOrWhiteSpace(sourceFilePath))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(outputDirectory))
        {
            return null;
        }

        return new MediaExtractAudioPayload(sourceFilePath.Trim(), outputDirectory.Trim(), audioFormat, customFileName);
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path);

    private static string NormalizeAudioFormat(string format)
    {
        var normalized = format.Trim().ToLowerInvariant();
        return normalized switch
        {
            "mp3" => "mp3",
            "wav" => "wav",
            _ => "m4a"
        };
    }

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
            sanitized = $"audio_{fallback}";
        }

        const int maxLength = 200;
        if (sanitized.Length > maxLength)
        {
            sanitized = sanitized[..maxLength];
        }

        return sanitized;
    }
}
