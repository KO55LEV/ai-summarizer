using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Notes;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Application.Projects;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Domain.Notes;
using AiSummarizer.Infrastructure.Storage;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class TelegramIngestJobHandler(
    INotesRepository notesRepository,
    IProjectsRepository projectsRepository,
    TelegramBotApiClient telegramClient,
    IHttpClientFactory httpClientFactory,
    IReasoningClientFactory reasoningClientFactory,
    IOptions<WhisperTranscribeOptions> whisperOptions,
    IOptions<TelegramOptions> telegramOptions,
    IOptions<StorageOptions> storageOptions,
    ILogger<TelegramIngestJobHandler> logger) : IJobHandler
{
    public string JobType => "notes.telegram.ingest";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var update = context.Job.Payload;
        if (!TryGetMessage(update, out var message))
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Telegram ingest job payload does not contain a message.", null);
        }

        var telegramUserId = TryGetLong(message, "from", "id", out var senderId)
            ? senderId
            : throw new InvalidOperationException("Telegram message does not contain sender information.");

        var requestedByUserId = context.Job.RequestedByUserId;
        if (requestedByUserId is null)
        {
            return JobHandlerResult.DeadLetter("missing_user", "Telegram ingest job is missing requestedByUserId.", null);
        }

        var messageId = TryGetLong(message, "message_id", out var msgId) ? msgId : 0;
        var sourceChannel = "telegram";
        var externalSourceId = telegramUserId.ToString(CultureInfo.InvariantCulture);
        var externalMessageId = messageId.ToString(CultureInfo.InvariantCulture);
        var rawText = GetMessageText(message);
        var inputKind = ResolveInputKind(message);
        var title = BuildTitle(rawText, inputKind, messageId);
        var caption = NormalizeNullable(rawText);

        context.ReportProgress(5, "Preparing Telegram note");
        var state = await EnsureNoteStateAsync(requestedByUserId.Value, externalSourceId, externalMessageId, sourceChannel, inputKind, title, rawText, update, context.Job.Id, cancellationToken);
        if (state.IsAlreadyComplete)
        {
            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                noteId = state.NoteId,
                noteInputId = state.NoteInputId,
                skipped = true,
                reason = "already_processed"
            }));
        }

        if (inputKind == NoteInputKind.Text)
        {
            if (string.IsNullOrWhiteSpace(rawText))
            {
                return JobHandlerResult.DeadLetter("invalid_payload", "Telegram text message is empty.", null);
            }

            var textVersion = NormalizeRequired(rawText);
            var projectId = await ResolveProjectIdAsync(requestedByUserId.Value, textVersion, cancellationToken);
            var now = DateTimeOffset.UtcNow;
            var originalTextVersionId = Guid.NewGuid();
            var polished = await TryPolishTextAsync(textVersion, cancellationToken);
            var polishedTextVersionId = polished is null ? (Guid?)null : Guid.NewGuid();

            await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
            {
                var note = await txRepo.GetNoteByIdAsync(state.NoteId, cancellationToken) ?? throw new InvalidOperationException("Note not found.");
                _ = await txRepo.CreateNoteTextVersionAsync(new NoteTextVersion
                {
                    Id = originalTextVersionId,
                    NoteId = note.Id,
                    SourceRunId = state.IngestRunId,
                    VersionKind = NoteTextVersionKind.Original,
                    Text = textVersion,
                    Language = null,
                    Provider = null,
                    Model = null,
                    PromptVersion = null,
                    CreatedAt = now
                }, tx, cancellationToken);

                await txRepo.UpdateNoteInputAsync((await txRepo.GetNoteInputByIdAsync(state.NoteInputId, cancellationToken))! with
                {
                    Status = NoteInputStatus.Succeeded,
                    ProcessedAt = now,
                    UpdatedAt = now
                }, tx, cancellationToken);

                await txRepo.UpdateNoteAsync(note with
                {
                    ProjectId = projectId ?? note.ProjectId,
                    CurrentTextVersionId = polishedTextVersionId ?? originalTextVersionId,
                    Summary = BuildSummary(polished?.Text ?? textVersion),
                    Status = NoteStatus.Ready,
                    UpdatedAt = now
                }, tx, cancellationToken);

                await txRepo.UpdateNoteProcessingRunAsync((await txRepo.GetNoteProcessingRunByIdAsync(state.IngestRunId!.Value, cancellationToken))! with
                {
                    Status = NoteProcessingStatus.Succeeded,
                    FinishedAt = now,
                    UpdatedAt = now
                }, tx, cancellationToken);

                if (polished is not null && polishedTextVersionId is not null)
                {
                    _ = await txRepo.CreateNoteProcessingRunAsync(new NoteProcessingRun
                    {
                        Id = Guid.NewGuid(),
                        NoteId = note.Id,
                        JobId = context.Job.Id,
                        Stage = NoteProcessingStage.Rewrite,
                        Status = NoteProcessingStatus.Succeeded,
                        Provider = polished.Provider,
                        Model = polished.Model,
                        PromptVersion = polished.PromptVersion,
                        InputHash = ComputeHash(textVersion, polished.Text, null),
                        Request = JsonSerializer.SerializeToElement(new { original = textVersion }),
                        Response = JsonSerializer.SerializeToElement(new { polished = polished.Text }),
                        Output = JsonSerializer.SerializeToElement(new { polished = polished.Text }),
                        Usage = null,
                        Metrics = null,
                        ErrorCode = null,
                        ErrorMessage = null,
                        StartedAt = now,
                        FinishedAt = now,
                        CreatedAt = now,
                        UpdatedAt = now
                    }, tx, cancellationToken);

                    _ = await txRepo.CreateNoteTextVersionAsync(new NoteTextVersion
                    {
                        Id = polishedTextVersionId.Value,
                        NoteId = note.Id,
                        SourceRunId = state.IngestRunId,
                        VersionKind = NoteTextVersionKind.Polished,
                        Text = polished.Text,
                        Language = polished.Language,
                        Provider = polished.Provider,
                        Model = polished.Model,
                        PromptVersion = polished.PromptVersion,
                        CreatedAt = now
                    }, tx, cancellationToken);
                }

                return true;
            }, cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new { noteId = state.NoteId, textVersionId = originalTextVersionId, processed = true }));
        }

        var media = ResolveMedia(message);
        if (media is null)
        {
            var existingNow = DateTimeOffset.UtcNow;
            await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
            {
                var note = await txRepo.GetNoteByIdAsync(state.NoteId, cancellationToken) ?? throw new InvalidOperationException("Note not found.");
                await txRepo.UpdateNoteInputAsync((await txRepo.GetNoteInputByIdAsync(state.NoteInputId, cancellationToken))! with
                {
                    Status = NoteInputStatus.Skipped,
                    ProcessedAt = existingNow,
                    UpdatedAt = existingNow
                }, tx, cancellationToken);
                await txRepo.UpdateNoteAsync(note with
                {
                    Status = NoteStatus.Ready,
                    Summary = BuildSummary(caption),
                    UpdatedAt = existingNow
                }, tx, cancellationToken);
                await txRepo.UpdateNoteProcessingRunAsync((await txRepo.GetNoteProcessingRunByIdAsync(state.IngestRunId!.Value, cancellationToken))! with
                {
                    Status = NoteProcessingStatus.Succeeded,
                    FinishedAt = existingNow,
                    UpdatedAt = existingNow
                }, tx, cancellationToken);
                return true;
            }, cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new { noteId = state.NoteId, processed = true, media = false }));
        }

        var storageRoot = StoragePathResolver.ResolveRoot(storageOptions.Value.RootPath, "data");
        var telegramDirectory = Path.Combine(storageRoot, "telegram", telegramUserId.ToString(CultureInfo.InvariantCulture), messageId.ToString(CultureInfo.InvariantCulture));
        Directory.CreateDirectory(telegramDirectory);

        var filePath = await telegramClient.GetFilePathAsync(media.FileId, cancellationToken);
        var localFileName = Path.GetFileName(filePath);
        if (string.IsNullOrWhiteSpace(localFileName))
        {
            localFileName = $"{media.Kind}_{media.FileId}.bin";
        }

        var localFilePath = Path.Combine(telegramDirectory, localFileName);
        await using (var fileStream = File.Create(localFilePath))
        {
            await telegramClient.DownloadFileAsync(filePath, fileStream, cancellationToken);
        }

        var checksum = await ComputeSha256Async(localFilePath, cancellationToken);
        var assetStorageKey = BuildStorageKey("telegram", telegramUserId, messageId, localFileName);
        var captionText = NormalizeNullable(caption);
        string? whisperTranscript = null;
        string? language = null;
        Guid? transcriptTextVersionId = null;
        var whisperRunId = Guid.NewGuid();

        if (media.Kind is "voice" or "audio")
        {
            context.ReportProgress(30, "Transcribing audio");
            var transcriptJson = await TranscribeAsync(localFilePath, whisperOptions.Value.Language, whisperOptions.Value, cancellationToken);
            whisperTranscript = ExtractTranscriptText(transcriptJson);
            language = ExtractTranscriptLanguage(transcriptJson);

            if (string.IsNullOrWhiteSpace(whisperTranscript))
            {
                return JobHandlerResult.DeadLetter("whisper_empty_transcript", "Whisper returned an empty transcript.", JsonSerializer.SerializeToElement(new { filePath = localFilePath }));
            }

            await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
            {
                var note = await txRepo.GetNoteByIdAsync(state.NoteId, cancellationToken) ?? throw new InvalidOperationException("Note not found.");
                _ = await txRepo.CreateNoteProcessingRunAsync(new NoteProcessingRun
                {
                    Id = whisperRunId,
                    NoteId = note.Id,
                    JobId = context.Job.Id,
                    Stage = NoteProcessingStage.Whisper,
                    Status = NoteProcessingStatus.Succeeded,
                    Provider = "whisper-service",
                    Model = null,
                    PromptVersion = null,
                    InputHash = checksum,
                    Request = JsonSerializer.SerializeToElement(new { sourceFilePath = localFilePath }),
                    Response = JsonSerializer.SerializeToElement(new { transcript = whisperTranscript, language }),
                    Output = JsonSerializer.SerializeToElement(new { transcript = whisperTranscript }),
                    Usage = null,
                    Metrics = null,
                    ErrorCode = null,
                    ErrorMessage = null,
                    StartedAt = DateTimeOffset.UtcNow,
                    FinishedAt = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

                transcriptTextVersionId = Guid.NewGuid();
                _ = await txRepo.CreateNoteTextVersionAsync(new NoteTextVersion
                {
                    Id = transcriptTextVersionId.Value,
                    NoteId = note.Id,
                    SourceRunId = whisperRunId,
                    VersionKind = NoteTextVersionKind.Transcript,
                    Text = NormalizeRequired(whisperTranscript),
                    Language = NormalizeNullable(language),
                    Provider = "whisper-service",
                    Model = null,
                    PromptVersion = null,
                    CreatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

                await txRepo.CreateNoteAssetAsync(new NoteAsset
                {
                    Id = Guid.NewGuid(),
                    NoteId = note.Id,
                    NoteInputId = state.NoteInputId,
                    AssetType = media.Kind,
                    MimeType = media.MimeType,
                    StorageKey = assetStorageKey,
                    OriginalFilename = localFileName,
                    SizeBytes = new FileInfo(localFilePath).Length,
                    ChecksumSha256 = checksum,
                    DurationSeconds = media.DurationSeconds,
                    Width = media.Width,
                    Height = media.Height,
                    Metadata = JsonSerializer.SerializeToElement(new
                    {
                        telegramUserId,
                        messageId,
                        fileId = media.FileId,
                        filePath
                    }),
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

            var resolvedProjectId = await ResolveProjectIdAsync(requestedByUserId.Value, whisperTranscript, cancellationToken);
            var polished = await TryPolishTextAsync(whisperTranscript ?? captionText, cancellationToken);
            var polishedTextVersionId = polished is null ? (Guid?)null : Guid.NewGuid();
            await txRepo.UpdateNoteInputAsync((await txRepo.GetNoteInputByIdAsync(state.NoteInputId, cancellationToken))! with
            {
                RawText = NormalizeNullable(whisperTranscript) ?? captionText,
                Status = NoteInputStatus.Succeeded,
                ProcessedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

                await txRepo.UpdateNoteAsync(note with
                {
                    ProjectId = resolvedProjectId ?? note.ProjectId,
                    CurrentTextVersionId = polishedTextVersionId ?? transcriptTextVersionId,
                    Summary = BuildSummary(polished?.Text ?? whisperTranscript ?? captionText),
                    Status = NoteStatus.Ready,
                    PrimaryLanguage = NormalizeNullable(language) ?? note.PrimaryLanguage,
                    UpdatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

                await txRepo.UpdateNoteProcessingRunAsync((await txRepo.GetNoteProcessingRunByIdAsync(state.IngestRunId!.Value, cancellationToken))! with
                {
                    Status = NoteProcessingStatus.Succeeded,
                    FinishedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                }, tx, cancellationToken);

                if (polished is not null && polishedTextVersionId is not null)
                {
                    _ = await txRepo.CreateNoteProcessingRunAsync(new NoteProcessingRun
                    {
                        Id = Guid.NewGuid(),
                        NoteId = note.Id,
                        JobId = context.Job.Id,
                        Stage = NoteProcessingStage.Rewrite,
                        Status = NoteProcessingStatus.Succeeded,
                        Provider = polished.Provider,
                        Model = polished.Model,
                        PromptVersion = polished.PromptVersion,
                        InputHash = ComputeHash(whisperTranscript ?? captionText, polished.Text, null),
                        Request = JsonSerializer.SerializeToElement(new { original = whisperTranscript ?? captionText }),
                        Response = JsonSerializer.SerializeToElement(new { polished = polished.Text }),
                        Output = JsonSerializer.SerializeToElement(new { polished = polished.Text }),
                        Usage = null,
                        Metrics = null,
                        ErrorCode = null,
                        ErrorMessage = null,
                        StartedAt = DateTimeOffset.UtcNow,
                        FinishedAt = DateTimeOffset.UtcNow,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    }, tx, cancellationToken);

                    _ = await txRepo.CreateNoteTextVersionAsync(new NoteTextVersion
                    {
                        Id = polishedTextVersionId.Value,
                        NoteId = note.Id,
                        SourceRunId = state.IngestRunId,
                        VersionKind = NoteTextVersionKind.Polished,
                        Text = polished.Text,
                        Language = polished.Language,
                        Provider = polished.Provider,
                        Model = polished.Model,
                        PromptVersion = polished.PromptVersion,
                        CreatedAt = DateTimeOffset.UtcNow
                    }, tx, cancellationToken);
                }

                return true;
            }, cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                noteId = state.NoteId,
                textVersionId = transcriptTextVersionId,
                mediaKind = media.Kind,
                processed = true
            }));
        }

        await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
        {
            var note = await txRepo.GetNoteByIdAsync(state.NoteId, cancellationToken) ?? throw new InvalidOperationException("Note not found.");
            _ = await txRepo.CreateNoteTextVersionAsync(new NoteTextVersion
            {
                Id = Guid.NewGuid(),
                NoteId = note.Id,
                SourceRunId = state.IngestRunId,
                VersionKind = NoteTextVersionKind.Original,
                Text = NormalizeRequired(captionText ?? rawText),
                Language = null,
                Provider = null,
                Model = null,
                PromptVersion = null,
                CreatedAt = DateTimeOffset.UtcNow
            }, tx, cancellationToken);

            await txRepo.CreateNoteAssetAsync(new NoteAsset
            {
                Id = Guid.NewGuid(),
                NoteId = note.Id,
                NoteInputId = state.NoteInputId,
                AssetType = media.Kind,
                MimeType = media.MimeType,
                StorageKey = assetStorageKey,
                OriginalFilename = localFileName,
                SizeBytes = new FileInfo(localFilePath).Length,
                ChecksumSha256 = checksum,
                DurationSeconds = media.DurationSeconds,
                Width = media.Width,
                Height = media.Height,
                Metadata = JsonSerializer.SerializeToElement(new
                {
                    telegramUserId,
                    messageId,
                    fileId = media.FileId,
                    filePath
                }),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, tx, cancellationToken);

            await txRepo.UpdateNoteInputAsync((await txRepo.GetNoteInputByIdAsync(state.NoteInputId, cancellationToken))! with
            {
                RawText = captionText,
                Status = NoteInputStatus.Succeeded,
                ProcessedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, tx, cancellationToken);

            await txRepo.UpdateNoteAsync(note with
            {
                ProjectId = await ResolveProjectIdAsync(requestedByUserId.Value, captionText, cancellationToken) ?? note.ProjectId,
                Summary = BuildSummary((await TryPolishTextAsync(captionText, cancellationToken))?.Text ?? captionText),
                Status = NoteStatus.Ready,
                UpdatedAt = DateTimeOffset.UtcNow
            }, tx, cancellationToken);

            await txRepo.UpdateNoteProcessingRunAsync((await txRepo.GetNoteProcessingRunByIdAsync(state.IngestRunId!.Value, cancellationToken))! with
            {
                Status = NoteProcessingStatus.Succeeded,
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, tx, cancellationToken);

            return true;
        }, cancellationToken);

        return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new { noteId = state.NoteId, mediaKind = media.Kind, processed = true }));
    }

    private async Task<TelegramNoteState> EnsureNoteStateAsync(
        Guid requestedByUserId,
        string externalSourceId,
        string externalMessageId,
        string sourceChannel,
        NoteInputKind inputKind,
        string title,
        string? rawText,
        JsonElement update,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var updateId = GetUpdateId(update);
        var existingInput = await notesRepository.GetNoteInputByExternalIdentityAsync(sourceChannel, externalSourceId, externalMessageId, cancellationToken);
        if (existingInput is not null)
        {
            var note = await notesRepository.GetNoteByIdAsync(existingInput.NoteId, cancellationToken) ?? throw new InvalidOperationException("Telegram note input references a missing note.");
            if (note.Status == NoteStatus.Ready && note.CurrentTextVersionId is not null)
            {
                return new TelegramNoteState(note.Id, existingInput.Id, null, true);
            }

            var existingNow = DateTimeOffset.UtcNow;
            var ingestRunId = Guid.NewGuid();
            await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
            {
                var txInput = await txRepo.GetNoteInputByIdAsync(existingInput.Id, cancellationToken) ?? throw new InvalidOperationException("Telegram note input was not found.");
                var txNote = await txRepo.GetNoteByIdAsync(note.Id, cancellationToken) ?? throw new InvalidOperationException("Telegram note was not found.");

                await txRepo.CreateNoteProcessingRunAsync(new NoteProcessingRun
                {
                    Id = ingestRunId,
                    NoteId = txNote.Id,
                    JobId = jobId,
                    Stage = NoteProcessingStage.Ingest,
                    Status = NoteProcessingStatus.Running,
                    Provider = null,
                    Model = null,
                    PromptVersion = null,
                    InputHash = ComputeHash(externalSourceId, externalMessageId, rawText),
                    Request = JsonSerializer.SerializeToElement(new { updateId }),
                    Response = null,
                    Output = null,
                    Usage = null,
                    Metrics = null,
                    ErrorCode = null,
                    ErrorMessage = null,
                    StartedAt = existingNow,
                    FinishedAt = null,
                    CreatedAt = existingNow,
                    UpdatedAt = existingNow
                }, tx, cancellationToken);

                await txRepo.UpdateNoteInputAsync(txInput with
                {
                    Status = NoteInputStatus.Processing,
                    ProcessedAt = null,
                    UpdatedAt = existingNow
                }, tx, cancellationToken);

                await txRepo.UpdateNoteAsync(txNote with
                {
                    Status = NoteStatus.Processing,
                    UpdatedAt = existingNow
                }, tx, cancellationToken);

                return true;
            }, cancellationToken);

            return new TelegramNoteState(note.Id, existingInput.Id, ingestRunId, false);
        }

            var createdNow = DateTimeOffset.UtcNow;
            var projectId = await ResolveProjectIdAsync(requestedByUserId, rawText, cancellationToken);
        if (projectId is null)
        {
            projectId = (await projectsRepository.GetDefaultProjectAsync(requestedByUserId, cancellationToken))?.Id;
        }

        var created = await notesRepository.ExecuteInTransactionAsync(async (txRepo, tx) =>
        {
            var note = await txRepo.CreateNoteAsync(new Note
            {
                Id = Guid.NewGuid(),
                RequestedByUserId = requestedByUserId,
                ProjectId = projectId,
                Title = title,
                Status = NoteStatus.Processing,
                SourceChannel = NoteSourceChannel.Telegram,
                InputKind = inputKind,
                PrimaryLanguage = null,
                Summary = BuildSummary(rawText),
                CreatedAt = createdNow,
                UpdatedAt = createdNow
            }, tx, cancellationToken);

            var input = await txRepo.CreateNoteInputAsync(new NoteInput
            {
                Id = Guid.NewGuid(),
                NoteId = note.Id,
                SourceChannel = NoteSourceChannel.Telegram,
                ExternalSourceId = externalSourceId,
                ExternalMessageId = externalMessageId,
                InputKind = inputKind,
                RawText = NormalizeNullable(rawText),
                RawPayload = update,
                Status = NoteInputStatus.Processing,
                ReceivedAt = createdNow,
                ProcessedAt = null,
                CreatedAt = createdNow,
                UpdatedAt = createdNow
            }, tx, cancellationToken);

            var ingestRun = await txRepo.CreateNoteProcessingRunAsync(new NoteProcessingRun
            {
                Id = Guid.NewGuid(),
                NoteId = note.Id,
                JobId = jobId,
                Stage = NoteProcessingStage.Ingest,
                Status = NoteProcessingStatus.Running,
                Provider = null,
                Model = null,
                PromptVersion = null,
                InputHash = ComputeHash(externalSourceId, externalMessageId, rawText),
                Request = JsonSerializer.SerializeToElement(new { updateId }),
                Response = null,
                Output = null,
                Usage = null,
                Metrics = null,
                ErrorCode = null,
                ErrorMessage = null,
                StartedAt = createdNow,
                FinishedAt = null,
                CreatedAt = createdNow,
                UpdatedAt = createdNow
            }, tx, cancellationToken);

            return new TelegramNoteState(note.Id, input.Id, ingestRun.Id, false);
        }, cancellationToken);

        return created;
    }

    private async Task<Guid?> ResolveProjectIdAsync(Guid requestedByUserId, string? text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return (await projectsRepository.GetDefaultProjectAsync(requestedByUserId, cancellationToken))?.Id;
        }

        var projects = await projectsRepository.ListProjectsAsync(requestedByUserId, 100, 0, cancellationToken);
        var match = ScoreProjects(projects, text).OrderByDescending(candidate => candidate.Score).FirstOrDefault();
        if (match is null || match.Score < Math.Clamp(telegramOptions.Value.RoutingConfidenceThreshold, 0.01, 1.0))
        {
            return null;
        }

        return match.Project.Id;
    }

    private static IReadOnlyList<ProjectMatchCandidate> ScoreProjects(IReadOnlyList<AiSummarizer.Domain.Projects.Project> projects, string text)
    {
        var normalizedText = NormalizeForMatch(text);
        var textTokens = Tokenize(normalizedText);
        var candidates = new List<ProjectMatchCandidate>();

        foreach (var project in projects)
        {
            var score = ScoreProject(project, normalizedText, textTokens);
            if (score > 0)
            {
                candidates.Add(new ProjectMatchCandidate(project, score));
            }
        }

        return candidates;
    }

    private static double ScoreProject(AiSummarizer.Domain.Projects.Project project, string normalizedText, IReadOnlyList<string> textTokens)
    {
        var name = NormalizeForMatch(project.Name);
        var description = NormalizeForMatch(project.Description ?? string.Empty);
        var aliases = project.Aliases.Select(NormalizeForMatch).Where(alias => !string.IsNullOrWhiteSpace(alias)).ToArray();

        if (normalizedText == name || aliases.Any(alias => alias == normalizedText))
        {
            return 1.0;
        }

        if (!string.IsNullOrWhiteSpace(name) && (normalizedText.Contains(name, StringComparison.OrdinalIgnoreCase) || name.Contains(normalizedText, StringComparison.OrdinalIgnoreCase)))
        {
            return 0.94;
        }

        if (aliases.Any(alias => normalizedText.Contains(alias, StringComparison.OrdinalIgnoreCase) || alias.Contains(normalizedText, StringComparison.OrdinalIgnoreCase)))
        {
            return 0.92;
        }

        var projectTokens = new HashSet<string>(Tokenize($"{name} {description} {string.Join(" ", aliases)}"), StringComparer.OrdinalIgnoreCase);
        if (projectTokens.Count == 0 || textTokens.Count == 0)
        {
            return 0;
        }

        var intersection = textTokens.Count(token => projectTokens.Contains(token));
        if (intersection == 0)
        {
            return 0;
        }

        var union = projectTokens.Count + textTokens.Distinct(StringComparer.OrdinalIgnoreCase).Count() - intersection;
        var jaccard = union <= 0 ? 0 : (double)intersection / union;
        var coverage = (double)intersection / Math.Max(1, Math.Min(projectTokens.Count, textTokens.Count));
        return Math.Max(jaccard, coverage) * 0.9;
    }

    private async Task<PolishedTextResult?> TryPolishTextAsync(string? text, CancellationToken cancellationToken)
    {
        if (!telegramOptions.Value.PolishEnabled || string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        if (!Enum.TryParse<ReasoningProvider>(telegramOptions.Value.PolishProvider, true, out var provider))
        {
            return null;
        }

        var model = telegramOptions.Value.PolishModel;
        if (string.IsNullOrWhiteSpace(model))
        {
            return null;
        }

        try
        {
            var client = reasoningClientFactory.GetClient(provider);
            var response = await client.CompleteAsync(new ReasoningRequest(
                Model: model,
                SystemPrompt: "Rewrite the note into a concise, clear, human-readable note. Preserve meaning and facts. Do not add new information. Return only the rewritten note.",
                UserPrompt: text.Trim(),
                Messages: null,
                Temperature: telegramOptions.Value.PolishTemperature,
                MaxTokens: telegramOptions.Value.PolishMaxTokens,
                ResponseFormat: null), cancellationToken);

            var polished = response.Text.Trim();
            if (string.IsNullOrWhiteSpace(polished) || string.Equals(polished, text.Trim(), StringComparison.Ordinal))
            {
                return null;
            }

            return new PolishedTextResult(polished, response.Provider.ToString(), response.Model, telegramOptions.Value.PolishPromptVersion);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram note polish failed");
            return null;
        }
    }

    private async Task<string> TranscribeAsync(string sourceFilePath, string? language, WhisperTranscribeOptions whisperOptions, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = Timeout.InfiniteTimeSpan;
        client.BaseAddress = NormalizeBaseUri(whisperOptions.WhisperServiceBaseUrl);

        await using var fileStream = File.OpenRead(sourceFilePath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(GetContentType(sourceFilePath));

        using var multipart = new MultipartFormDataContent();
        multipart.Add(fileContent, "file", Path.GetFileName(sourceFilePath));
        if (!string.IsNullOrWhiteSpace(language))
        {
            multipart.Add(new StringContent(language), "language");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, whisperOptions.TranscribePath)
        {
            Content = multipart
        };

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, whisperOptions.RequestTimeoutSeconds)));

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
        var responseBody = await response.Content.ReadAsStringAsync(timeoutCts.Token);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Whisper service returned {(int)response.StatusCode} {response.ReasonPhrase}: {responseBody}");
        }

        return responseBody;
    }

    private static string? ExtractTranscriptText(string transcriptJson)
    {
        using var document = JsonDocument.Parse(transcriptJson);
        var root = document.RootElement;
        if (root.TryGetProperty("text", out var textProperty))
        {
            return textProperty.GetString();
        }

        if (!root.TryGetProperty("segments", out var segmentsProperty) || segmentsProperty.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var parts = new List<string>();
        foreach (var segment in segmentsProperty.EnumerateArray())
        {
            if (segment.TryGetProperty("text", out var segmentText) && !string.IsNullOrWhiteSpace(segmentText.GetString()))
            {
                parts.Add(segmentText.GetString()!.Trim());
            }
        }

        return parts.Count == 0 ? null : string.Join(" ", parts);
    }

    private static string? ExtractTranscriptLanguage(string transcriptJson)
    {
        using var document = JsonDocument.Parse(transcriptJson);
        var root = document.RootElement;
        return root.TryGetProperty("language", out var languageProperty) ? languageProperty.GetString() : null;
    }

    private static MediaDescriptor? ResolveMedia(JsonElement message)
    {
        if (message.TryGetProperty("voice", out var voice) && voice.ValueKind == JsonValueKind.Object && voice.TryGetProperty("file_id", out var voiceFileId))
        {
            return new MediaDescriptor("voice", voiceFileId.GetString() ?? string.Empty, GetStringProperty(voice, "mime_type") ?? "audio/ogg", GetLongProperty(voice, "duration"), null, null);
        }

        if (message.TryGetProperty("audio", out var audio) && audio.ValueKind == JsonValueKind.Object && audio.TryGetProperty("file_id", out var audioFileId))
        {
            return new MediaDescriptor("audio", audioFileId.GetString() ?? string.Empty, GetStringProperty(audio, "mime_type") ?? "application/octet-stream", GetLongProperty(audio, "duration"), null, null);
        }

        if (message.TryGetProperty("document", out var document) && document.ValueKind == JsonValueKind.Object && document.TryGetProperty("file_id", out var documentFileId))
        {
            return new MediaDescriptor("file", documentFileId.GetString() ?? string.Empty, GetStringProperty(document, "mime_type") ?? "application/octet-stream", null, null, null);
        }

        if (message.TryGetProperty("photo", out var photo) && photo.ValueKind == JsonValueKind.Array && photo.GetArrayLength() > 0)
        {
            var selected = photo.EnumerateArray().Last();
            if (selected.TryGetProperty("file_id", out var photoFileId))
            {
                return new MediaDescriptor("image", photoFileId.GetString() ?? string.Empty, "image/jpeg", null, GetIntProperty(selected, "width"), GetIntProperty(selected, "height"));
            }
        }

        return null;
    }

    private static NoteInputKind ResolveInputKind(JsonElement message)
    {
        return ResolveMedia(message) is { } media
            ? media.Kind switch
            {
                "voice" or "audio" => NoteInputKind.Audio,
                "image" => NoteInputKind.Image,
                "file" => NoteInputKind.File,
                _ => NoteInputKind.Mixed
            }
            : NoteInputKind.Text;
    }

    private static string? GetMessageText(JsonElement message)
    {
        if (message.TryGetProperty("text", out var text) && !string.IsNullOrWhiteSpace(text.GetString()))
        {
            return text.GetString();
        }

        if (message.TryGetProperty("caption", out var caption) && !string.IsNullOrWhiteSpace(caption.GetString()))
        {
            return caption.GetString();
        }

        return null;
    }

    private static string BuildTitle(string? rawText, NoteInputKind inputKind, long messageId)
    {
        if (!string.IsNullOrWhiteSpace(rawText))
        {
            var normalized = rawText.Trim().ReplaceLineEndings(" ");
            return normalized.Length <= 80 ? normalized : normalized[..80].TrimEnd();
        }

        return inputKind switch
        {
            NoteInputKind.Audio => $"Voice note #{messageId}",
            NoteInputKind.Image => $"Image note #{messageId}",
            NoteInputKind.File => $"File note #{messageId}",
            _ => $"Telegram note #{messageId}"
        };
    }

    private static string? BuildSummary(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = text.Trim().ReplaceLineEndings(" ");
        return normalized.Length <= 240 ? normalized : normalized[..240].TrimEnd();
    }

    private static string ComputeHash(string externalSourceId, string externalMessageId, string? text)
    {
        var bytes = Encoding.UTF8.GetBytes($"{externalSourceId}:{externalMessageId}:{text ?? string.Empty}");
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    private static string BuildStorageKey(string channel, long telegramUserId, long messageId, string fileName)
        => $"{channel}/{telegramUserId}/{messageId}/{fileName}";

    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeRequired(string value)
        => string.IsNullOrWhiteSpace(value) ? throw new InvalidOperationException("Text is required.") : value.Trim();

    private static string NormalizeForMatch(string value)
        => new string(value.Trim().Where(c => !char.IsPunctuation(c)).ToArray()).Trim().ToLowerInvariant();

    private static IReadOnlyList<string> Tokenize(string value)
        => value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token.Length > 1)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

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
            ".oga" => "audio/ogg",
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            _ => "application/octet-stream"
        };
    }

    private static async Task<string> ComputeSha256Async(string filePath, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(filePath);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static bool TryGetMessage(JsonElement update, out JsonElement message)
    {
        message = default;
        return update.ValueKind == JsonValueKind.Object && update.TryGetProperty("message", out message);
    }

    private static bool TryGetLong(JsonElement element, string propertyName, out long value)
    {
        value = default;
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) && property.TryGetInt64(out value);
    }

    private static long? GetUpdateId(JsonElement update)
        => TryGetLong(update, "update_id", out var updateId) ? updateId : null;

    private static bool TryGetLong(JsonElement element, string firstProperty, string secondProperty, out long value)
    {
        value = default;
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(firstProperty, out var nested) || nested.ValueKind != JsonValueKind.Object || !nested.TryGetProperty(secondProperty, out var nestedValue))
        {
            return false;
        }

        return nestedValue.TryGetInt64(out value);
    }

    private static string? GetStringProperty(JsonElement element, string propertyName)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) ? property.GetString() : null;

    private static int? GetIntProperty(JsonElement element, string propertyName)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) && property.TryGetInt32(out var value) ? value : null;

    private static decimal? GetLongProperty(JsonElement element, string propertyName)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) && property.TryGetDecimal(out var value) ? value : null;

    private sealed record ProjectMatchCandidate(AiSummarizer.Domain.Projects.Project Project, double Score);
    private sealed record PolishedTextResult(string Text, string Provider, string? Model, string? PromptVersion, string? Language = null);
    private sealed record TelegramNoteState(Guid NoteId, Guid NoteInputId, Guid? IngestRunId, bool IsAlreadyComplete);

    private sealed record MediaDescriptor(string Kind, string FileId, string MimeType, decimal? DurationSeconds, int? Width, int? Height);
}
