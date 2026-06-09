using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Projects;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Notes;

namespace AiSummarizer.Application.Notes;

public sealed class NotesService(
    INotesRepository repository,
    IProjectsRepository projectsRepository,
    IUsersRepository usersRepository,
    INoteAssetStorage noteAssetStorage,
    IJobsService jobsService) : INotesService
{
    public async Task<NotesListDto> ListNotesAsync(Guid? requestedByUserId, Guid? projectId, int limit, int offset, CancellationToken cancellationToken)
        => new((await repository.ListNotesAsync(requestedByUserId, projectId, limit, offset, cancellationToken)).Select(note => MapNote(note)).ToArray());

    public async Task<NoteDetailDto> GetNoteAsync(Guid noteId, CancellationToken cancellationToken)
    {
        var note = await repository.GetNoteByIdAsync(noteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        return await BuildDetailAsync(note, cancellationToken);
    }

    public async Task<NoteDetailDto> CreateNoteAsync(CreateNoteCommand command, CancellationToken cancellationToken)
    {
        var requestedByUserId = RequireRequestedByUserId(command.RequestedByUserId);
        await EnsureUserExistsAsync(requestedByUserId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var projectId = await ResolveProjectIdAsync(requestedByUserId, command.ProjectId, cancellationToken);
        var normalizedSummary = NormalizeNullable(command.Summary);
        var normalizedTitle = NormalizeOptionalTitle(command.Title);
        if (string.IsNullOrWhiteSpace(normalizedTitle) && !string.IsNullOrWhiteSpace(normalizedSummary))
        {
            normalizedTitle = BuildAutoTitle(normalizedSummary);
        }

        var note = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var created = await txRepository.CreateNoteAsync(new Note
            {
                Id = Guid.NewGuid(),
                RequestedByUserId = requestedByUserId,
                ProjectId = projectId,
                Title = normalizedTitle,
                Status = NoteStatus.Draft,
                SourceChannel = ParseSourceChannel(command.SourceChannel),
                InputKind = ParseInputKind(command.InputKind),
                PrimaryLanguage = NormalizeNullable(command.PrimaryLanguage),
                Summary = normalizedSummary,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);

            if (string.IsNullOrWhiteSpace(normalizedSummary))
            {
                return created;
            }

            _ = await txRepository.CreateNoteInputAsync(new NoteInput
            {
                Id = Guid.NewGuid(),
                NoteId = created.Id,
                SourceChannel = ParseSourceChannel(command.SourceChannel),
                ExternalSourceId = null,
                ExternalMessageId = null,
                InputKind = NoteInputKind.Text,
                RawText = normalizedSummary,
                RawPayload = JsonSerializer.SerializeToElement(new { text = normalizedSummary }),
                Status = NoteInputStatus.Succeeded,
                ReceivedAt = now,
                ProcessedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);

            var textVersion = await txRepository.CreateNoteTextVersionAsync(new NoteTextVersion
            {
                Id = Guid.NewGuid(),
                NoteId = created.Id,
                SourceAssetId = null,
                SourceRunId = null,
                VersionKind = NoteTextVersionKind.Original,
                Text = normalizedSummary,
                Language = NormalizeNullable(command.PrimaryLanguage),
                Provider = "local",
                Model = null,
                PromptVersion = null,
                CreatedAt = now
            }, tx, cancellationToken);

            return await txRepository.UpdateNoteAsync(created with
            {
                Status = NoteStatus.Ready,
                CurrentTextVersionId = textVersion.Id,
                Summary = normalizedSummary,
                UpdatedAt = now
            }, tx, cancellationToken);
        }, cancellationToken);

        return await BuildDetailAsync(note, cancellationToken);
    }

    public async Task<NoteDetailDto> UpdateNoteAsync(Guid noteId, UpdateNoteCommand command, CancellationToken cancellationToken)
    {
        var existing = await repository.GetNoteByIdAsync(noteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        var note = await repository.UpdateNoteAsync(existing with
        {
            Title = NormalizeRequired(command.Title),
            Status = ParseStatus(command.Status),
            ProjectId = command.ProjectId ?? existing.ProjectId,
            PrimaryLanguage = NormalizeNullable(command.PrimaryLanguage),
            Summary = NormalizeNullable(command.Summary),
            CurrentTextVersionId = command.CurrentTextVersionId ?? existing.CurrentTextVersionId,
            UpdatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);

        return await BuildDetailAsync(note, cancellationToken);
    }

    public async Task DeleteNoteAsync(Guid noteId, CancellationToken cancellationToken)
    {
        var existing = await repository.GetNoteByIdAsync(noteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        await repository.DeleteNoteAsync(existing.Id, null, cancellationToken);
    }

    public async Task<NoteInputDto> AddNoteInputAsync(CreateNoteInputCommand command, CancellationToken cancellationToken)
    {
        var note = await repository.GetNoteByIdAsync(command.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        var created = await repository.CreateNoteInputAsync(new NoteInput
        {
            Id = Guid.NewGuid(),
            NoteId = note.Id,
            SourceChannel = ParseSourceChannel(command.SourceChannel),
            ExternalSourceId = NormalizeNullable(command.ExternalSourceId),
            ExternalMessageId = NormalizeNullable(command.ExternalMessageId),
            InputKind = ParseInputKind(command.InputKind),
            RawText = NormalizeNullable(command.RawText),
            RawPayload = NormalizeJson(command.RawPayload),
            Status = ParseInputStatus(command.Status),
            ReceivedAt = command.ReceivedAt,
            ProcessedAt = command.ProcessedAt,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);

        return MapInput(created);
    }

    public async Task<NoteAssetDto> AddNoteAssetAsync(CreateNoteAssetCommand command, CancellationToken cancellationToken)
    {
        _ = await repository.GetNoteByIdAsync(command.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        var created = await repository.CreateNoteAssetAsync(new NoteAsset
        {
            Id = Guid.NewGuid(),
            NoteId = command.NoteId,
            NoteInputId = command.NoteInputId,
            AssetType = NormalizeRequired(command.AssetType),
            MimeType = NormalizeRequired(command.MimeType),
            StorageKey = NormalizeRequired(command.StorageKey),
            OriginalFilename = NormalizeNullable(command.OriginalFilename),
            SizeBytes = command.SizeBytes,
            ChecksumSha256 = NormalizeNullable(command.ChecksumSha256),
            DurationSeconds = command.DurationSeconds,
            Width = command.Width,
            Height = command.Height,
            Metadata = NormalizeJson(command.Metadata),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);

        await ScheduleAssetProcessingAsync(created, cancellationToken);
        return MapAsset(created);
    }

    public async Task<NoteAssetDto> UploadNoteAssetAsync(UploadNoteAssetCommand command, CancellationToken cancellationToken)
    {
        var note = await repository.GetNoteByIdAsync(command.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        if (command.NoteInputId is not null)
        {
            var noteInput = await repository.GetNoteInputByIdAsync(command.NoteInputId.Value, cancellationToken)
                ?? throw new NoteValidationException("Note input not found.");

            if (noteInput.NoteId != note.Id)
            {
                throw new NoteConflictException("Note input does not belong to this note.");
            }
        }

        var assetId = Guid.NewGuid();
        var originalFilename = string.IsNullOrWhiteSpace(command.OriginalFilename)
            ? "upload"
            : Path.GetFileName(command.OriginalFilename.Trim());
        var contentType = NormalizeMimeType(command.ContentType);
        var storageResult = await noteAssetStorage.SaveAsync(
            new NoteAssetStorageRequest(note.Id, assetId, originalFilename, contentType),
            command.Content,
            cancellationToken);

        NoteAsset created;
        try
        {
            created = await repository.CreateNoteAssetAsync(new NoteAsset
            {
                Id = assetId,
                NoteId = note.Id,
                NoteInputId = command.NoteInputId,
                AssetType = InferAssetType(contentType),
                MimeType = contentType,
                StorageKey = storageResult.StorageKey,
                OriginalFilename = originalFilename,
                SizeBytes = storageResult.SizeBytes,
                ChecksumSha256 = storageResult.ChecksumSha256,
                DurationSeconds = null,
                Width = null,
                Height = null,
                Metadata = EmptyJson(),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }, null, cancellationToken);
        }
        catch
        {
            try
            {
                await noteAssetStorage.DeleteAsync(storageResult.StorageKey, cancellationToken);
            }
            catch
            {
                // Best-effort cleanup only.
            }

            throw;
        }

        await ScheduleAssetProcessingAsync(created, cancellationToken);
        return MapAsset(created);
    }

    public async Task<NoteTextVersionDto> AddNoteTextVersionAsync(CreateNoteTextVersionCommand command, CancellationToken cancellationToken)
    {
        _ = await repository.GetNoteByIdAsync(command.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        var created = await repository.CreateNoteTextVersionAsync(new NoteTextVersion
        {
            Id = Guid.NewGuid(),
            NoteId = command.NoteId,
            SourceAssetId = command.SourceAssetId,
            SourceRunId = command.SourceRunId,
            VersionKind = ParseTextVersionKind(command.VersionKind),
            Text = command.Text.Trim(),
            Language = NormalizeNullable(command.Language),
            Provider = NormalizeNullable(command.Provider),
            Model = NormalizeNullable(command.Model),
            PromptVersion = NormalizeNullable(command.PromptVersion),
            CreatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);

        return MapTextVersion(created);
    }

    public async Task<NoteProcessingRunDto> AddNoteProcessingRunAsync(CreateNoteProcessingRunCommand command, CancellationToken cancellationToken)
    {
        _ = await repository.GetNoteByIdAsync(command.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        var now = DateTimeOffset.UtcNow;
        var created = await repository.CreateNoteProcessingRunAsync(new NoteProcessingRun
        {
            Id = Guid.NewGuid(),
            NoteId = command.NoteId,
            JobId = command.JobId,
            SourceAssetId = command.SourceAssetId,
            Stage = ParseStage(command.Stage),
            Status = ParseProcessingStatus(command.Status),
            Provider = NormalizeNullable(command.Provider),
            Model = NormalizeNullable(command.Model),
            PromptVersion = NormalizeNullable(command.PromptVersion),
            InputHash = NormalizeNullable(command.InputHash),
            Request = NormalizeJsonElement(command.Request),
            Response = NormalizeJsonElement(command.Response),
            Output = NormalizeJsonElement(command.Output),
            Usage = NormalizeJsonElement(command.Usage),
            Metrics = NormalizeJsonElement(command.Metrics),
            ErrorCode = NormalizeNullable(command.ErrorCode),
            ErrorMessage = NormalizeNullable(command.ErrorMessage),
            StartedAt = command.StartedAt,
            FinishedAt = command.FinishedAt,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return MapProcessingRun(created);
    }

    public async Task<IReadOnlyList<NoteInputDto>> ListNoteInputsAsync(Guid noteId, CancellationToken cancellationToken)
        => (await repository.ListNoteInputsAsync(noteId, cancellationToken)).Select(MapInput).ToArray();

    public async Task<IReadOnlyList<NoteAssetDto>> ListNoteAssetsAsync(Guid noteId, CancellationToken cancellationToken)
        => (await repository.ListNoteAssetsAsync(noteId, cancellationToken)).Select(MapAsset).ToArray();

    public async Task<IReadOnlyList<NoteTextVersionDto>> ListNoteTextVersionsAsync(Guid noteId, CancellationToken cancellationToken)
        => (await repository.ListNoteTextVersionsAsync(noteId, cancellationToken)).Select(MapTextVersion).ToArray();

    public async Task<IReadOnlyList<NoteProcessingRunDto>> ListNoteProcessingRunsAsync(Guid noteId, int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListNoteProcessingRunsAsync(noteId, limit, offset, cancellationToken)).Select(MapProcessingRun).ToArray();

    public async Task<TelegramAccountDto> UpsertTelegramAccountAsync(LinkTelegramAccountCommand command, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(command.RequestedByUserId, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        var account = await repository.UpsertTelegramAccountAsync(new TelegramAccount
        {
            Id = Guid.NewGuid(),
            TelegramUserId = command.TelegramUserId,
            Username = NormalizeNullable(command.Username),
            FirstName = NormalizeNullable(command.FirstName),
            LastName = NormalizeNullable(command.LastName),
            DisplayName = NormalizeNullable(command.DisplayName),
            LanguageCode = NormalizeNullable(command.LanguageCode),
            IsBot = command.IsBot,
            LastSeenAt = now,
            Metadata = EmptyJson(),
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return MapTelegramAccount(account);
    }

    public async Task<UserTelegramAccountDto> LinkTelegramAccountAsync(Guid requestedByUserId, Guid telegramAccountId, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(requestedByUserId, cancellationToken);

        var account = await repository.GetTelegramAccountByIdAsync(telegramAccountId, cancellationToken)
            ?? throw new NoteValidationException("Telegram account not found.");

        var existingLink = await repository.GetUserTelegramAccountByTelegramAccountIdAsync(account.Id, cancellationToken);
        if (existingLink is not null && existingLink.RequestedByUserId != requestedByUserId)
        {
            throw new NoteConflictException("Telegram account is already linked to another user.");
        }

        var now = DateTimeOffset.UtcNow;
        var linked = await repository.LinkUserTelegramAccountAsync(new UserTelegramAccount
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = requestedByUserId,
            TelegramAccountId = account.Id,
            LinkedAt = now,
            RevokedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return MapUserTelegramAccount(linked);
    }

    public async Task RevokeTelegramAccountLinkAsync(Guid userTelegramAccountId, CancellationToken cancellationToken)
        => await repository.RevokeUserTelegramAccountAsync(userTelegramAccountId, DateTimeOffset.UtcNow, null, cancellationToken);

    public async Task<TelegramAccountDto?> GetTelegramAccountByTelegramUserIdAsync(long telegramUserId, CancellationToken cancellationToken)
        => MapTelegramAccountNullable(await repository.GetTelegramAccountByTelegramUserIdAsync(telegramUserId, cancellationToken));

    public async Task<TelegramAccountDto?> GetTelegramAccountByIdAsync(Guid telegramAccountId, CancellationToken cancellationToken)
        => MapTelegramAccountNullable(await repository.GetTelegramAccountByIdAsync(telegramAccountId, cancellationToken));

    public async Task<UserTelegramAccountDto?> GetLinkedTelegramAccountAsync(Guid userId, CancellationToken cancellationToken)
        => MapUserTelegramAccountNullable(await repository.GetUserTelegramAccountByUserIdAsync(userId, cancellationToken));

    private async Task ScheduleAssetProcessingAsync(NoteAsset asset, CancellationToken cancellationToken)
    {
        var note = await repository.GetNoteByIdAsync(asset.NoteId, cancellationToken)
            ?? throw new NoteNotFoundException("Note not found.");

        if (note.Status is NoteStatus.Archived or NoteStatus.Deleted)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var request = JsonSerializer.SerializeToElement(new
        {
            noteId = asset.NoteId,
            noteAssetId = asset.Id,
            storageKey = asset.StorageKey,
            mimeType = asset.MimeType,
            originalFilename = asset.OriginalFilename
        });

        var processingRun = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            _ = await txRepository.UpdateNoteAsync(note with
            {
                Status = NoteStatus.Processing,
                UpdatedAt = now
            }, tx, cancellationToken);

            return await txRepository.CreateNoteProcessingRunAsync(new NoteProcessingRun
            {
                Id = Guid.NewGuid(),
                NoteId = asset.NoteId,
                JobId = null,
                SourceAssetId = asset.Id,
                Stage = ResolveProcessingStage(asset),
                Status = NoteProcessingStatus.Queued,
                Provider = null,
                Model = null,
                PromptVersion = null,
                InputHash = asset.ChecksumSha256,
                Request = request,
                Response = null,
                Output = null,
                Usage = null,
                Metrics = null,
                ErrorCode = null,
                ErrorMessage = null,
                StartedAt = null,
                FinishedAt = null,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);
        }, cancellationToken);

        var job = await jobsService.CreateJobAsync(new CreateJobCommand(
            "notes.process_asset",
            JsonSerializer.SerializeToElement(new
            {
                noteId = asset.NoteId,
                noteAssetId = asset.Id,
                processingRunId = processingRun.Id
            }),
            50,
            note.RequestedByUserId,
            null,
            3), cancellationToken);

        await repository.UpdateNoteProcessingRunAsync(processingRun with
        {
            JobId = job.Job.Id,
            UpdatedAt = DateTimeOffset.UtcNow
        }, null, cancellationToken);
    }

    private static bool IsAudioAsset(NoteAsset asset)
        => asset.MimeType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
           || asset.AssetType.Equals("audio", StringComparison.OrdinalIgnoreCase);

    private static NoteProcessingStage ResolveProcessingStage(NoteAsset asset)
    {
        if (IsAudioAsset(asset))
        {
            return NoteProcessingStage.Whisper;
        }

        if (asset.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) || asset.AssetType.Equals("image", StringComparison.OrdinalIgnoreCase))
        {
            return NoteProcessingStage.Ocr;
        }

        return NoteProcessingStage.Rewrite;
    }

    private async Task<NoteDetailDto> BuildDetailAsync(Note note, CancellationToken cancellationToken)
    {
        var projectName = note.ProjectId is null
            ? null
            : (await projectsRepository.GetProjectByIdAsync(note.ProjectId.Value, cancellationToken))?.Name;

        return new NoteDetailDto(
            MapNote(note, projectName),
            await ListNoteInputsAsync(note.Id, cancellationToken),
            await ListNoteAssetsAsync(note.Id, cancellationToken),
            await ListNoteTextVersionsAsync(note.Id, cancellationToken),
            await ListNoteProcessingRunsAsync(note.Id, 100, 0, cancellationToken));
    }

    private async Task<Guid?> ResolveProjectIdAsync(Guid requestedByUserId, Guid? projectId, CancellationToken cancellationToken)
    {
        if (projectId is not null)
        {
            _ = await projectsRepository.GetProjectByIdAsync(projectId.Value, cancellationToken)
                ?? throw new NoteValidationException("Project not found.");
            return projectId;
        }

        var defaultProject = await projectsRepository.GetDefaultProjectAsync(requestedByUserId, cancellationToken);
        if (defaultProject is not null)
        {
            return defaultProject.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var created = await projectsRepository.CreateProjectAsync(new Domain.Projects.Project
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = requestedByUserId,
            Name = "Inbox",
            Description = "Default inbox for uncategorized notes",
            Status = Domain.Projects.ProjectStatus.Active,
            IsDefault = true,
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);

        return created.Id;
    }

    private async Task EnsureUserExistsAsync(Guid userId, CancellationToken cancellationToken)
    {
        _ = await usersRepository.GetUserByIdAsync(userId, null, cancellationToken)
            ?? throw new NoteValidationException("RequestedByUserId must reference an existing user.");
    }

    private static Guid RequireRequestedByUserId(Guid? requestedByUserId)
        => requestedByUserId ?? throw new NoteValidationException("RequestedByUserId is required.");

    private static string NormalizeRequired(string value)
        => string.IsNullOrWhiteSpace(value) ? throw new NoteValidationException("Value is required.") : value.Trim();

    private static string NormalizeOptionalTitle(string? value)
        => NormalizeNullable(value) ?? string.Empty;

    private static string NormalizeTitle(string value)
        => NormalizeRequired(value);

    private static string BuildAutoTitle(string text)
    {
        var normalized = NormalizeNullable(text);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        var firstSentenceEnd = normalized.IndexOfAny(new[] { '.', '!', '?' });
        var candidate = firstSentenceEnd > 0 ? normalized[..(firstSentenceEnd + 1)] : normalized;
        candidate = candidate.Trim();
        if (candidate.Length > 72)
        {
            candidate = candidate[..69].TrimEnd() + "...";
        }

        return candidate.Length == 0 ? string.Empty : char.ToUpperInvariant(candidate[0]) + candidate[1..];
    }

    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string NormalizeMimeType(string? value) => string.IsNullOrWhiteSpace(value) ? "application/octet-stream" : value.Trim().ToLowerInvariant();

    private static JsonElement NormalizeJson(JsonElement element)
        => element.ValueKind == JsonValueKind.Undefined ? JsonDocument.Parse("{}").RootElement.Clone() : element.Clone();

    private static JsonElement? NormalizeJsonElement(JsonElement? element)
        => element is null ? null : NormalizeJson(element.Value);

    private static JsonElement EmptyJson() => JsonDocument.Parse("{}").RootElement.Clone();

    private static NoteSourceChannel ParseSourceChannel(string value) => Enum.Parse<NoteSourceChannel>(value.Trim(), true);
    private static NoteInputKind ParseInputKind(string value) => Enum.Parse<NoteInputKind>(value.Trim(), true);
    private static NoteInputStatus ParseInputStatus(string value) => Enum.Parse<NoteInputStatus>(value.Trim(), true);
    private static NoteStatus ParseStatus(string value) => Enum.Parse<NoteStatus>(value.Trim(), true);
    private static NoteTextVersionKind ParseTextVersionKind(string value) => Enum.Parse<NoteTextVersionKind>(value.Trim(), true);
    private static NoteProcessingStage ParseStage(string value) => Enum.Parse<NoteProcessingStage>(value.Trim(), true);
    private static NoteProcessingStatus ParseProcessingStatus(string value) => Enum.Parse<NoteProcessingStatus>(value.Trim(), true);

    private static string InferAssetType(string mimeType)
    {
        if (mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return "image";
        }

        if (mimeType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
        {
            return "audio";
        }

        if (mimeType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return "pdf";
        }

        return "file";
    }

    private static NoteDto MapNote(Note note, string? projectName = null)
        => new(
            note.Id,
            note.RequestedByUserId,
            note.ProjectId,
            projectName,
            note.Title,
            note.Status.ToString().ToLowerInvariant(),
            note.SourceChannel.ToString().ToLowerInvariant(),
            note.InputKind.ToString().ToLowerInvariant(),
            note.PrimaryLanguage,
            note.CurrentTextVersionId,
            note.Summary,
            note.CreatedAt,
            note.UpdatedAt);

    private static NoteInputDto MapInput(NoteInput input)
        => new(
            input.Id,
            input.NoteId,
            input.SourceChannel.ToString().ToLowerInvariant(),
            input.ExternalSourceId,
            input.ExternalMessageId,
            input.InputKind.ToString().ToLowerInvariant(),
            input.RawText,
            input.RawPayload,
            input.Status.ToString().ToLowerInvariant(),
            input.ReceivedAt,
            input.ProcessedAt,
            input.CreatedAt,
            input.UpdatedAt);

    private static NoteAssetDto MapAsset(NoteAsset asset)
        => new(
            asset.Id,
            asset.NoteId,
            asset.NoteInputId,
            asset.AssetType,
            asset.MimeType,
            asset.StorageKey,
            asset.OriginalFilename,
            asset.SizeBytes,
            asset.ChecksumSha256,
            asset.DurationSeconds,
            asset.Width,
            asset.Height,
            asset.Metadata,
            asset.CreatedAt,
            asset.UpdatedAt);

    private static NoteTextVersionDto MapTextVersion(NoteTextVersion version)
        => new(
            version.Id,
            version.NoteId,
            version.SourceAssetId,
            version.SourceRunId,
            version.VersionKind.ToString().ToLowerInvariant(),
            version.Text,
            version.Language,
            version.Provider,
            version.Model,
            version.PromptVersion,
            version.CreatedAt);

    private static NoteProcessingRunDto MapProcessingRun(NoteProcessingRun run)
        => new(
            run.Id,
            run.NoteId,
            run.JobId,
            run.SourceAssetId,
            run.Stage.ToString().ToLowerInvariant(),
            run.Status.ToString().ToLowerInvariant(),
            run.Provider,
            run.Model,
            run.PromptVersion,
            run.InputHash,
            run.Request,
            run.Response,
            run.Output,
            run.Usage,
            run.Metrics,
            run.ErrorCode,
            run.ErrorMessage,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt,
            run.UpdatedAt);

    private static TelegramAccountDto MapTelegramAccount(TelegramAccount account)
        => new(
            account.Id,
            account.TelegramUserId,
            account.Username,
            account.FirstName,
            account.LastName,
            account.DisplayName,
            account.LanguageCode,
            account.IsBot,
            account.LastSeenAt,
            account.Metadata,
            account.CreatedAt,
            account.UpdatedAt);

    private static TelegramAccountDto? MapTelegramAccountNullable(TelegramAccount? account)
        => account is null ? null : MapTelegramAccount(account);

    private static UserTelegramAccountDto MapUserTelegramAccount(UserTelegramAccount account)
        => new(
            account.Id,
            account.RequestedByUserId,
            account.TelegramAccountId,
            account.LinkedAt,
            account.RevokedAt,
            account.CreatedAt,
            account.UpdatedAt);

    private static UserTelegramAccountDto? MapUserTelegramAccountNullable(UserTelegramAccount? account)
        => account is null ? null : MapUserTelegramAccount(account);
}
