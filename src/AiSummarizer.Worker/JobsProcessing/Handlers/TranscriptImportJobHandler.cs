using System.Text;
using System.Text.Json;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.Transcripts;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class TranscriptImportJobHandler(
    ITranscriptsRepository transcriptsRepository,
    ILogger<TranscriptImportJobHandler> logger) : IJobHandler
{
    public string JobType => "transcript.import";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Transcript import job payload is missing the transcript file path or source metadata.", null);
        }

        if (!File.Exists(payload.TranscriptFilePath))
        {
            return JobHandlerResult.DeadLetter(
                "transcript_file_missing",
                $"Transcript file was not found: {payload.TranscriptFilePath}",
                JsonSerializer.SerializeToElement(new { transcriptFilePath = payload.TranscriptFilePath }));
        }

        if (string.IsNullOrWhiteSpace(payload.SourceFilePath) && string.IsNullOrWhiteSpace(payload.SourceUrl))
        {
            return JobHandlerResult.DeadLetter(
                "invalid_payload",
                "Transcript import job payload must include either sourceFilePath or sourceUrl.",
                JsonSerializer.SerializeToElement(new { transcriptFilePath = payload.TranscriptFilePath }));
        }

        if (!string.IsNullOrWhiteSpace(payload.SourceFilePath) && !File.Exists(payload.SourceFilePath))
        {
            return JobHandlerResult.DeadLetter(
                "source_file_missing",
                $"Source audio file was not found: {payload.SourceFilePath}",
                JsonSerializer.SerializeToElement(new { sourceFilePath = payload.SourceFilePath }));
        }

        await context.LogInfoAsync("Starting transcript import", JsonSerializer.SerializeToElement(new
        {
            transcriptFilePath = payload.TranscriptFilePath,
            sourceFilePath = payload.SourceFilePath,
            sourceUrl = payload.SourceUrl,
            sourceJobId = payload.SourceJobId
        }), cancellationToken);

        var transcriptJson = await File.ReadAllTextAsync(payload.TranscriptFilePath, cancellationToken);
        using var document = JsonDocument.Parse(transcriptJson);
        var root = document.RootElement;

        if (!root.TryGetProperty("segments", out var segmentsProperty) || segmentsProperty.ValueKind != JsonValueKind.Array)
        {
            return JobHandlerResult.DeadLetter("invalid_transcript", "Transcript file does not contain a valid segments array.", JsonSerializer.SerializeToElement(new
            {
                transcriptFilePath = payload.TranscriptFilePath
            }));
        }

        var language = root.TryGetProperty("language", out var languageProperty) ? languageProperty.GetString() ?? "unknown" : "unknown";
        var languageProbability = root.TryGetProperty("languageProbability", out var languageProbabilityProperty) && languageProbabilityProperty.TryGetDecimal(out var lp) ? lp : 0m;
        var duration = root.TryGetProperty("duration", out var durationProperty) && durationProperty.TryGetDecimal(out var durationValue) ? durationValue : 0m;

        var transcriptId = context.Job.Id;
        var sourceId = payload.SourceId;
        var sourceJobId = payload.SourceJobId ?? context.Job.ParentJobId;
        var transcriptBuilder = new StringBuilder();
        var transcriptSegments = new List<TranscriptSegment>();

        var segmentIndex = 0;
        foreach (var segmentElement in segmentsProperty.EnumerateArray())
        {
            var segmentText = segmentElement.TryGetProperty("text", out var textProperty) ? textProperty.GetString() ?? string.Empty : string.Empty;
            var normalizedText = segmentText.Trim();
            var startSeconds = segmentElement.TryGetProperty("start", out var startProperty) && startProperty.TryGetDecimal(out var startValue) ? startValue : 0m;
            var endSeconds = segmentElement.TryGetProperty("end", out var endProperty) && endProperty.TryGetDecimal(out var endValue) ? endValue : startSeconds;
            var speakerLabel = segmentElement.TryGetProperty("speaker", out var speakerProperty) ? speakerProperty.GetString() : null;

            var textOffsetStart = transcriptBuilder.Length == 0 ? 0 : transcriptBuilder.Length + Environment.NewLine.Length;
            if (transcriptBuilder.Length > 0)
            {
                transcriptBuilder.AppendLine();
            }

            transcriptBuilder.Append(normalizedText);
            var textOffsetEnd = transcriptBuilder.Length;
            var segmentWordCount = CountWords(normalizedText);

            transcriptSegments.Add(new TranscriptSegment
            {
                Id = Guid.NewGuid(),
                TranscriptId = transcriptId,
                SegmentIndex = segmentIndex,
                StartSeconds = startSeconds,
                EndSeconds = endSeconds,
                TextOffsetStart = textOffsetStart,
                TextOffsetEnd = textOffsetEnd,
                Text = normalizedText,
                SpeakerLabel = speakerLabel,
                WordCount = segmentWordCount,
                CharacterCount = normalizedText.Length,
                Metadata = segmentElement.ValueKind == JsonValueKind.Object ? segmentElement.Clone() : JsonSerializer.SerializeToElement(new { }),
                CreatedAt = DateTimeOffset.UtcNow
            });

            segmentIndex++;
        }

        var transcriptText = transcriptBuilder.ToString();
        var transcript = new Transcript
        {
            Id = transcriptId,
            JobId = context.Job.Id,
            SourceId = sourceId,
            SourceJobId = sourceJobId,
            SourceUrl = payload.SourceUrl,
            SourceFilePath = payload.SourceFilePath,
            TranscriptFilePath = payload.TranscriptFilePath,
            Language = language,
            LanguageProbability = languageProbability,
            DurationSeconds = duration,
            SegmentCount = transcriptSegments.Count,
            WordCount = CountWords(transcriptText),
            CharacterCount = transcriptText.Length,
            TranscriptText = transcriptText,
            Metadata = JsonSerializer.SerializeToElement(new
            {
                sourceJobId,
                sourceUrl = payload.SourceUrl,
                transcriptFilePath = payload.TranscriptFilePath,
                importedAtUtc = DateTimeOffset.UtcNow
            }),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            await transcriptsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                var savedTranscript = await repository.UpsertTranscriptAsync(transcript, transaction, cancellationToken);
                await repository.DeleteTranscriptSegmentsAsync(savedTranscript.Id, transaction, cancellationToken);
                await repository.CreateTranscriptSegmentsAsync(transcriptSegments, transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            context.ReportProgress(100, "Completed");
            await context.LogInfoAsync("Transcript import completed", JsonSerializer.SerializeToElement(new
            {
                transcriptId = transcript.Id,
                transcriptFilePath = payload.TranscriptFilePath,
                sourceFilePath = payload.SourceFilePath,
                sourceUrl = payload.SourceUrl,
                language = transcript.Language,
                languageProbability = transcript.LanguageProbability,
                duration = transcript.DurationSeconds,
                segmentCount = transcript.SegmentCount,
                wordCount = transcript.WordCount,
                characterCount = transcript.CharacterCount
            }), cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                transcriptId = transcript.Id,
                jobId = context.Job.Id,
                sourceJobId = transcript.SourceJobId,
                sourceUrl = transcript.SourceUrl,
                transcriptFilePath = transcript.TranscriptFilePath,
                sourceFilePath = transcript.SourceFilePath,
                language = transcript.Language,
                languageProbability = transcript.LanguageProbability,
                durationSeconds = transcript.DurationSeconds,
                segmentCount = transcript.SegmentCount,
                wordCount = transcript.WordCount,
                characterCount = transcript.CharacterCount
            }));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Transcript import failed");
            if (context.Job.AttemptCount < context.Job.MaxAttempts)
            {
                return JobHandlerResult.Retry(
                    "transcript_import_retryable",
                    ex.Message,
                    JsonSerializer.SerializeToElement(new
                    {
                        exception = ex.GetType().FullName,
                        stackTrace = ex.StackTrace
                    }),
                    TimeSpan.FromMinutes(1));
            }

            return JobHandlerResult.DeadLetter(
                "transcript_import_failed",
                ex.Message,
                JsonSerializer.SerializeToElement(new
                {
                    exception = ex.GetType().FullName,
                    stackTrace = ex.StackTrace
                }));
        }
    }

    private sealed record TranscriptImportPayload(string TranscriptFilePath, string? SourceFilePath, string? SourceUrl, Guid? SourceId, Guid? SourceJobId);

    private static TranscriptImportPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var transcriptFilePath = ReadString(payload, "transcriptFilePath", "filePath", "sourceTranscriptFilePath");
        var sourceFilePath = ReadString(payload, "sourceFilePath", "audioFilePath", "sourceAudioFilePath");
        var sourceUrl = ReadString(payload, "sourceUrl", "youtubeUrl", "sourceVideoUrl");
        var sourceId = ReadGuid(payload, "sourceId", "source_id");
        var sourceJobId = ReadGuid(payload, "sourceJobId", "whisperJobId");

        if (string.IsNullOrWhiteSpace(transcriptFilePath))
        {
            return null;
        }

        return new TranscriptImportPayload(transcriptFilePath, sourceFilePath, sourceUrl, sourceId, sourceJobId);
    }

    private static string? ReadString(JsonElement payload, params string[] names)
    {
        foreach (var name in names)
        {
            if (payload.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
            {
                var text = value.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }
        }

        return null;
    }

    private static Guid? ReadGuid(JsonElement payload, params string[] names)
    {
        foreach (var name in names)
        {
            if (payload.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var guid))
            {
                return guid;
            }
        }

        return null;
    }

    private static int CountWords(string text)
        => string.IsNullOrWhiteSpace(text)
            ? 0
            : text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length;
}
