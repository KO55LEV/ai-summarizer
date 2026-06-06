using System.Text.Json;

namespace AiSummarizer.Application.Notes;

public sealed record NoteDto(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string? ProjectName,
    string Title,
    string Status,
    string SourceChannel,
    string InputKind,
    string? PrimaryLanguage,
    Guid? CurrentTextVersionId,
    string? Summary,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record NoteListDto(
    IReadOnlyList<NoteDto> Notes);

public sealed record NoteInputDto(
    Guid Id,
    Guid NoteId,
    string SourceChannel,
    string? ExternalSourceId,
    string? ExternalMessageId,
    string InputKind,
    string? RawText,
    JsonElement RawPayload,
    string Status,
    DateTimeOffset ReceivedAt,
    DateTimeOffset? ProcessedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record NoteAssetDto(
    Guid Id,
    Guid NoteId,
    Guid? NoteInputId,
    string AssetType,
    string MimeType,
    string StorageKey,
    string? OriginalFilename,
    long? SizeBytes,
    string? ChecksumSha256,
    decimal? DurationSeconds,
    int? Width,
    int? Height,
    JsonElement Metadata,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record NoteTextVersionDto(
    Guid Id,
    Guid NoteId,
    Guid? SourceRunId,
    string VersionKind,
    string Text,
    string? Language,
    string? Provider,
    string? Model,
    string? PromptVersion,
    DateTimeOffset CreatedAt);

public sealed record NoteProcessingRunDto(
    Guid Id,
    Guid NoteId,
    Guid? JobId,
    string Stage,
    string Status,
    string? Provider,
    string? Model,
    string? PromptVersion,
    string? InputHash,
    JsonElement? Request,
    JsonElement? Response,
    JsonElement? Output,
    JsonElement? Usage,
    JsonElement? Metrics,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TelegramAccountDto(
    Guid Id,
    long TelegramUserId,
    string? Username,
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string? LanguageCode,
    bool IsBot,
    DateTimeOffset? LastSeenAt,
    JsonElement Metadata,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record UserTelegramAccountDto(
    Guid Id,
    Guid RequestedByUserId,
    Guid TelegramAccountId,
    DateTimeOffset LinkedAt,
    DateTimeOffset? RevokedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateNoteCommand(
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string Title,
    string SourceChannel,
    string InputKind,
    string? PrimaryLanguage,
    string? Summary);

public sealed record UpdateNoteCommand(
    string Title,
    string Status,
    Guid? ProjectId,
    string? PrimaryLanguage,
    string? Summary,
    Guid? CurrentTextVersionId = null);

public sealed record CreateNoteInputCommand(
    Guid NoteId,
    string SourceChannel,
    string? ExternalSourceId,
    string? ExternalMessageId,
    string InputKind,
    string? RawText,
    JsonElement RawPayload,
    string Status,
    DateTimeOffset ReceivedAt,
    DateTimeOffset? ProcessedAt);

public sealed record CreateNoteAssetCommand(
    Guid NoteId,
    Guid? NoteInputId,
    string AssetType,
    string MimeType,
    string StorageKey,
    string? OriginalFilename,
    long? SizeBytes,
    string? ChecksumSha256,
    decimal? DurationSeconds,
    int? Width,
    int? Height,
    JsonElement Metadata);

public sealed record CreateNoteTextVersionCommand(
    Guid NoteId,
    Guid? SourceRunId,
    string VersionKind,
    string Text,
    string? Language,
    string? Provider,
    string? Model,
    string? PromptVersion);

public sealed record CreateNoteProcessingRunCommand(
    Guid NoteId,
    Guid? JobId,
    string Stage,
    string Status,
    string? Provider,
    string? Model,
    string? PromptVersion,
    string? InputHash,
    JsonElement? Request,
    JsonElement? Response,
    JsonElement? Output,
    JsonElement? Usage,
    JsonElement? Metrics,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

public sealed record LinkTelegramAccountCommand(
    Guid RequestedByUserId,
    long TelegramUserId,
    string? Username,
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string? LanguageCode,
    bool IsBot);

public sealed record NoteDetailDto(
    NoteDto Note,
    IReadOnlyList<NoteInputDto> Inputs,
    IReadOnlyList<NoteAssetDto> Assets,
    IReadOnlyList<NoteTextVersionDto> TextVersions,
    IReadOnlyList<NoteProcessingRunDto> ProcessingRuns);

public sealed record NotesListDto(
    IReadOnlyList<NoteDto> Notes);
