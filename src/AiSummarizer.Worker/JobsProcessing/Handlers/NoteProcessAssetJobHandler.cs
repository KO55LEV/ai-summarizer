using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.Notes;
using AiSummarizer.Domain.Notes;
using AiSummarizer.Worker.JobsProcessing;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class NoteProcessAssetJobHandler(
    INotesRepository notesRepository,
    INoteAssetStorage noteAssetStorage,
    IHttpClientFactory httpClientFactory,
    IOptions<WhisperTranscribeOptions> whisperOptions,
    ILogger<NoteProcessAssetJobHandler> logger) : IJobHandler
{
    public string JobType => "notes.process_asset";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Note processing job payload is missing required fields.", null);
        }

        var note = await notesRepository.GetNoteByIdAsync(payload.NoteId, cancellationToken);
        if (note is null)
        {
            return JobHandlerResult.DeadLetter("note_not_found", $"Note was not found: {payload.NoteId}", JsonSerializer.SerializeToElement(new { payload.NoteId }));
        }

        var asset = await notesRepository.GetNoteAssetByIdAsync(payload.NoteAssetId, cancellationToken);
        if (asset is null)
        {
            return JobHandlerResult.DeadLetter("note_asset_not_found", $"Note asset was not found: {payload.NoteAssetId}", JsonSerializer.SerializeToElement(new { payload.NoteAssetId, payload.NoteId }));
        }

        if (asset.NoteId != note.Id)
        {
            return JobHandlerResult.DeadLetter("asset_mismatch", "Note asset does not belong to the referenced note.", JsonSerializer.SerializeToElement(new { payload.NoteId, payload.NoteAssetId, assetNoteId = asset.NoteId }));
        }

        var run = await notesRepository.GetNoteProcessingRunByIdAsync(payload.ProcessingRunId, cancellationToken);
        if (run is null)
        {
            return JobHandlerResult.DeadLetter("processing_run_not_found", $"Processing run was not found: {payload.ProcessingRunId}", JsonSerializer.SerializeToElement(new { payload.ProcessingRunId }));
        }

        if (run.NoteId != note.Id)
        {
            return JobHandlerResult.DeadLetter("processing_run_mismatch", "Processing run does not belong to the referenced note.", JsonSerializer.SerializeToElement(new { payload.NoteId, payload.ProcessingRunId }));
        }

        await MarkRunRunningAsync(run, cancellationToken);

        string? tempFilePath = null;
        try
        {
            string? candidateText;
            string? language = null;

            if (IsAudioAsset(asset))
            {
                tempFilePath = await CopyAssetToTempFileAsync(asset, cancellationToken);
                var transcriptJson = await TranscribeAsync(
                    tempFilePath,
                    whisperOptions.Value.WhisperServiceBaseUrl,
                    whisperOptions.Value.TranscribePath,
                    whisperOptions.Value.RequestTimeoutSeconds,
                    whisperOptions.Value.Language,
                    percent =>
                    {
                        var scaled = (short)Math.Clamp(10 + (percent * 0.8), 10, 95);
                        context.ReportProgress(scaled, $"Transcribing note audio: {percent:0}%");
                    },
                    cancellationToken);

                var transcript = ParseTranscript(transcriptJson);
                if (transcript is null)
                {
                    return await FailRunAsync(run, note, "invalid_transcript", "Whisper returned an invalid transcript payload.", JsonSerializer.SerializeToElement(new { asset.Id }), cancellationToken);
                }

                var transcriptValue = transcript.Value;
                candidateText = transcriptValue.TranscriptText;
                language = transcriptValue.Language;

                var now = DateTimeOffset.UtcNow;
                var created = await notesRepository.ExecuteInTransactionAsync(async (txRepository, tx) =>
                {
                    var textVersion = await txRepository.CreateNoteTextVersionAsync(new NoteTextVersion
                    {
                        Id = Guid.NewGuid(),
                        NoteId = note.Id,
                        SourceAssetId = asset.Id,
                        SourceRunId = run.Id,
                        VersionKind = NoteTextVersionKind.Transcript,
                        Text = transcriptValue.TranscriptText,
                        Language = transcriptValue.Language,
                        Provider = "whisper",
                        Model = null,
                        PromptVersion = null,
                        CreatedAt = now
                    }, tx, cancellationToken);

                    await txRepository.UpdateNoteProcessingRunAsync(run with
                    {
                        Status = NoteProcessingStatus.Succeeded,
                        SourceAssetId = asset.Id,
                        Provider = "whisper",
                        Model = null,
                        InputHash = asset.ChecksumSha256,
                        Request = JsonSerializer.SerializeToElement(new
                        {
                            noteId = note.Id,
                            noteAssetId = asset.Id,
                            storageKey = asset.StorageKey,
                            mimeType = asset.MimeType
                        }),
                        Response = ParseJsonElement(transcriptJson),
                        Output = JsonSerializer.SerializeToElement(new
                        {
                            transcriptText = transcriptValue.TranscriptText,
                            transcriptLength = transcriptValue.TranscriptText.Length,
                            segmentCount = transcriptValue.SegmentCount,
                            language = transcriptValue.Language,
                            durationSeconds = transcriptValue.DurationSeconds
                        }),
                        StartedAt = run.StartedAt ?? now,
                        FinishedAt = now,
                        UpdatedAt = now
                    }, tx, cancellationToken);

                    return textVersion;
                }, cancellationToken);

                context.ReportProgress(85, "Preparing summary");
                await context.LogInfoAsync("Note audio transcription completed", JsonSerializer.SerializeToElement(new
                {
                    noteId = note.Id,
                    noteAssetId = asset.Id,
                    textVersionId = created.Id,
                    language = transcriptValue.Language,
                    durationSeconds = transcriptValue.DurationSeconds,
                    segmentCount = transcriptValue.SegmentCount
                }), cancellationToken);
            }
            else
            {
                candidateText = BuildAssetFallbackText(asset);
                var now = DateTimeOffset.UtcNow;
                await notesRepository.UpdateNoteProcessingRunAsync(run with
                {
                    Status = NoteProcessingStatus.Succeeded,
                    SourceAssetId = asset.Id,
                    Provider = "local",
                    Model = null,
                    InputHash = asset.ChecksumSha256,
                    Request = JsonSerializer.SerializeToElement(new
                    {
                        noteId = note.Id,
                        noteAssetId = asset.Id,
                        storageKey = asset.StorageKey,
                        mimeType = asset.MimeType,
                        assetType = asset.AssetType
                    }),
                    Response = JsonSerializer.SerializeToElement(new
                    {
                        placeholder = true,
                        assetType = asset.AssetType,
                        mimeType = asset.MimeType,
                        originalFilename = asset.OriginalFilename
                    }),
                    Output = JsonSerializer.SerializeToElement(new
                    {
                        placeholder = true,
                        candidateText
                    }),
                    StartedAt = run.StartedAt ?? now,
                    FinishedAt = now,
                    UpdatedAt = now
                }, null, cancellationToken);

                context.ReportProgress(70, "Preparing summary");
                await context.LogInfoAsync("Note asset placeholder processing completed", JsonSerializer.SerializeToElement(new
                {
                    noteId = note.Id,
                    noteAssetId = asset.Id,
                    assetType = asset.AssetType,
                    mimeType = asset.MimeType
                }), cancellationToken);
            }

            await FinalizeNoteAsync(note, asset, candidateText, language, context, cancellationToken);

            context.ReportProgress(100, "Completed");
            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                noteId = note.Id,
                noteAssetId = asset.Id,
                processingRunId = run.Id,
                processed = true
            }));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Note asset processing failed for note {NoteId} asset {NoteAssetId}", note.Id, asset.Id);
            if (ex is WhisperServiceException serviceEx)
            {
                var statusCode = serviceEx.StatusCode;
                if (statusCode >= HttpStatusCode.BadRequest &&
                    statusCode < HttpStatusCode.InternalServerError &&
                    statusCode != HttpStatusCode.RequestTimeout &&
                    statusCode != HttpStatusCode.TooManyRequests)
                {
                    return await FailRunAsync(run, note, "note_transcription_failed", serviceEx.Message, JsonSerializer.SerializeToElement(new
                    {
                        noteId = note.Id,
                        noteAssetId = asset.Id,
                        statusCode = (int)serviceEx.StatusCode,
                        serviceError = serviceEx.ResponseBody,
                        exception = ex.GetType().FullName
                    }), cancellationToken);
                }
            }

            await MarkRunRetryingAsync(run, note, ex.Message, cancellationToken);
            return JobHandlerResult.Retry(
                "note_processing_retryable",
                ex.Message,
                JsonSerializer.SerializeToElement(new
                {
                    noteId = note.Id,
                    noteAssetId = asset.Id,
                    exception = ex.GetType().FullName,
                    stackTrace = ex.StackTrace
                }),
                whisperOptions.Value.RetryDelay);
        }
        finally
        {
            if (tempFilePath is not null)
            {
                try
                {
                    File.Delete(tempFilePath);
                }
                catch
                {
                    // best effort cleanup
                }
            }
        }
    }

    private async Task MarkRunRunningAsync(NoteProcessingRun run, CancellationToken cancellationToken)
    {
        await notesRepository.UpdateNoteProcessingRunAsync(run with
        {
            Status = NoteProcessingStatus.Running,
            StartedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);
    }

    private async Task MarkRunSkippedAsync(NoteProcessingRun run, string errorCode, string message, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await notesRepository.UpdateNoteProcessingRunAsync(run with
        {
            Status = NoteProcessingStatus.Succeeded,
            ErrorCode = errorCode,
            ErrorMessage = message,
            StartedAt = run.StartedAt ?? now,
            FinishedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);
    }

    private async Task<JobHandlerResult> FailRunAsync(NoteProcessingRun run, Note note, string errorCode, string errorMessage, JsonElement errorDetails, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await notesRepository.UpdateNoteProcessingRunAsync(run with
        {
            Status = NoteProcessingStatus.Failed,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            Request = run.Request ?? JsonSerializer.SerializeToElement(new { noteId = note.Id, noteAssetId = run.SourceAssetId }),
            Response = run.Response,
            Output = run.Output,
            StartedAt = run.StartedAt ?? now,
            FinishedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        await notesRepository.UpdateNoteAsync(note with
        {
            Status = NoteStatus.Failed,
            UpdatedAt = now
        }, null, cancellationToken);

        return JobHandlerResult.DeadLetter(errorCode, errorMessage, errorDetails);
    }

    private async Task MarkRunRetryingAsync(NoteProcessingRun run, Note note, string errorMessage, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await notesRepository.UpdateNoteProcessingRunAsync(run with
        {
            Status = NoteProcessingStatus.Retrying,
            ErrorCode = "note_processing_retryable",
            ErrorMessage = errorMessage,
            StartedAt = run.StartedAt ?? now,
            FinishedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        await notesRepository.UpdateNoteAsync(note with
        {
            Status = NoteStatus.Processing,
            UpdatedAt = now
        }, null, cancellationToken);
    }

    private async Task FinalizeNoteAsync(Note note, NoteAsset asset, string? candidateText, string? language, JobExecutionContext context, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var generatedTitle = BuildTitle(candidateText, asset);
        var generatedSummary = BuildSummary(candidateText, asset);
        var summaryRunId = Guid.NewGuid();
        var normalizedCandidate = NormalizeCandidateText(candidateText);

        await notesRepository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var currentNote = await txRepository.GetNoteByIdAsync(note.Id, cancellationToken)
                ?? throw new InvalidOperationException("Note not found.");

            _ = await txRepository.CreateNoteProcessingRunAsync(new NoteProcessingRun
            {
                Id = summaryRunId,
                NoteId = note.Id,
                JobId = context.Job.Id,
                SourceAssetId = asset.Id,
                Stage = NoteProcessingStage.Summarize,
                Status = NoteProcessingStatus.Succeeded,
                Provider = "local",
                Model = null,
                PromptVersion = null,
                InputHash = asset.ChecksumSha256,
                Request = JsonSerializer.SerializeToElement(new
                {
                    noteId = note.Id,
                    noteAssetId = asset.Id,
                    candidateText = normalizedCandidate,
                    assetType = asset.AssetType,
                    mimeType = asset.MimeType,
                    originalFilename = asset.OriginalFilename
                }),
                Response = JsonSerializer.SerializeToElement(new
                {
                    title = string.IsNullOrWhiteSpace(currentNote.Title) ? generatedTitle : currentNote.Title,
                    summary = string.IsNullOrWhiteSpace(currentNote.Summary) ? generatedSummary : currentNote.Summary
                }),
                Output = JsonSerializer.SerializeToElement(new
                {
                    title = string.IsNullOrWhiteSpace(currentNote.Title) ? generatedTitle : currentNote.Title,
                    summary = string.IsNullOrWhiteSpace(currentNote.Summary) ? generatedSummary : currentNote.Summary
                }),
                Usage = null,
                Metrics = null,
                ErrorCode = null,
                ErrorMessage = null,
                StartedAt = now,
                FinishedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);

            await txRepository.UpdateNoteAsync(currentNote with
            {
                Title = string.IsNullOrWhiteSpace(currentNote.Title) ? generatedTitle : currentNote.Title,
                Summary = string.IsNullOrWhiteSpace(currentNote.Summary) ? generatedSummary : currentNote.Summary,
                PrimaryLanguage = string.IsNullOrWhiteSpace(currentNote.PrimaryLanguage) ? language : currentNote.PrimaryLanguage,
                Status = NoteStatus.Ready,
                UpdatedAt = now
            }, tx, cancellationToken);

            return true;
        }, cancellationToken);
    }

    private static string BuildSummary(string? candidateText, NoteAsset asset)
    {
        var normalized = NormalizeCandidateText(candidateText);
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            return TruncateSentence(normalized, 240);
        }

        return BuildAssetFallbackText(asset);
    }

    private static string BuildTitle(string? candidateText, NoteAsset asset)
    {
        var normalized = NormalizeCandidateText(candidateText);
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            var firstSentence = ExtractFirstSentence(normalized);
            if (!string.IsNullOrWhiteSpace(firstSentence))
            {
                return EnsureTitleCase(Truncate(firstSentence, 72));
            }

            return EnsureTitleCase(Truncate(normalized, 72));
        }

        var fallback = BuildAssetFallbackText(asset);
        return EnsureTitleCase(Truncate(fallback, 72));
    }

    private static string BuildAssetFallbackText(NoteAsset asset)
    {
        var label = asset.AssetType.Trim().ToLowerInvariant() switch
        {
            "audio" => "audio note",
            "image" => "image note",
            "file" => "file note",
            "pdf" => "pdf note",
            _ => "note"
        };

        if (!string.IsNullOrWhiteSpace(asset.OriginalFilename))
        {
            var fileName = Path.GetFileNameWithoutExtension(asset.OriginalFilename.Trim());
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                return fileName.Replace('_', ' ').Replace('-', ' ');
            }
        }

        return label;
    }

    private static string NormalizeCandidateText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim();
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized;
    }

    private static string ExtractFirstSentence(string text)
    {
        var sentenceEnd = text.IndexOfAny(new[] { '.', '!', '?' });
        if (sentenceEnd <= 0)
        {
            return text;
        }

        return text[..(sentenceEnd + 1)].Trim();
    }

    private static string TruncateSentence(string text, int maxLength)
    {
        var normalized = NormalizeCandidateText(text);
        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        var truncated = Truncate(normalized, maxLength);
        var lastSpace = truncated.LastIndexOf(' ');
        return lastSpace > 0 ? truncated[..lastSpace].TrimEnd() : truncated;
    }

    private static string Truncate(string text, int maxLength)
        => text.Length <= maxLength ? text : text[..Math.Max(0, maxLength - 3)].TrimEnd() + "...";

    private static string EnsureTitleCase(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "Untitled note";
        }

        return char.ToUpperInvariant(text[0]) + text[1..];
    }

    private async Task<string> CopyAssetToTempFileAsync(NoteAsset asset, CancellationToken cancellationToken)
    {
        var tempDirectory = Path.Combine(Path.GetTempPath(), "ai-summarizer", "notes", asset.NoteId.ToString("N"), asset.Id.ToString("N"));
        Directory.CreateDirectory(tempDirectory);

        var extension = Path.GetExtension(asset.StorageKey);
        if (string.IsNullOrWhiteSpace(extension) && !string.IsNullOrWhiteSpace(asset.OriginalFilename))
        {
            extension = Path.GetExtension(asset.OriginalFilename);
        }

        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = asset.MimeType.StartsWith("audio/mp4", StringComparison.OrdinalIgnoreCase) ? ".m4a" : ".bin";
        }

        var tempFilePath = Path.Combine(tempDirectory, $"source{extension}");
        await using var source = await noteAssetStorage.OpenReadAsync(asset.StorageKey, cancellationToken);
        await using var destination = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await source.CopyToAsync(destination, cancellationToken);
        await destination.FlushAsync(cancellationToken);
        return tempFilePath;
    }

    private async Task<string> TranscribeAsync(
        string sourceFilePath,
        string baseUrl,
        string transcribePath,
        int timeoutSeconds,
        string? language,
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

    private static bool IsAudioAsset(NoteAsset asset)
        => asset.MimeType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase);

    private static WhisperTranscribePayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!ReadGuid(payload, out var noteId, "noteId", "note_id"))
        {
            return null;
        }

        if (!ReadGuid(payload, out var noteAssetId, "noteAssetId", "note_asset_id"))
        {
            return null;
        }

        if (!ReadGuid(payload, out var processingRunId, "processingRunId", "processing_run_id"))
        {
            return null;
        }

        return new WhisperTranscribePayload(noteId, noteAssetId, processingRunId);
    }

    private static bool ReadGuid(JsonElement payload, out Guid value, params string[] names)
    {
        foreach (var name in names)
        {
            if (payload.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String && Guid.TryParse(property.GetString(), out value))
            {
                return true;
            }
        }

        value = Guid.Empty;
        return false;
    }

    private static (string TranscriptText, string? Language, double? DurationSeconds, int SegmentCount)? ParseTranscript(string transcriptJson)
    {
        using var document = JsonDocument.Parse(transcriptJson);
        var root = document.RootElement;
        if (!root.TryGetProperty("segments", out var segmentsProperty) || segmentsProperty.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var transcriptBuilder = new StringBuilder();
        var segmentCount = 0;
        foreach (var segment in segmentsProperty.EnumerateArray())
        {
            var text = segment.TryGetProperty("text", out var textProperty) ? textProperty.GetString() ?? string.Empty : string.Empty;
            var normalized = text.Trim();
            if (normalized.Length == 0)
            {
                continue;
            }

            if (transcriptBuilder.Length > 0)
            {
                transcriptBuilder.AppendLine();
            }

            transcriptBuilder.Append(normalized);
            segmentCount++;
        }

        var language = root.TryGetProperty("language", out var languageProperty) ? languageProperty.GetString() : null;
        var duration = root.TryGetProperty("duration", out var durationProperty) && durationProperty.TryGetDouble(out var durationValue) ? (double?)durationValue : null;
        return (transcriptBuilder.ToString(), language, duration, segmentCount);
    }

    private static JsonElement ParseJsonElement(string json)
        => JsonDocument.Parse(json).RootElement.Clone();

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

    private sealed record WhisperTranscribePayload(Guid NoteId, Guid NoteAssetId, Guid ProcessingRunId);

    private sealed class WhisperServiceException(HttpStatusCode statusCode, string responseBody) : Exception($"Whisper service returned {(int)statusCode} ({statusCode}).")
    {
        public HttpStatusCode StatusCode { get; } = statusCode;
        public string ResponseBody { get; } = responseBody;
    }
}
