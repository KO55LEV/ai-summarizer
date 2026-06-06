using System.Text.Json;

namespace AiSummarizer.Api.Notes;

public sealed record CreateNoteRequest(
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string Title,
    string SourceChannel,
    string InputKind,
    string? PrimaryLanguage,
    string? Summary);

public sealed record UpdateNoteRequest(
    string Title,
    string Status,
    Guid? ProjectId,
    string? PrimaryLanguage,
    string? Summary);

public sealed record CreateNoteInputRequest(
    string SourceChannel,
    string? ExternalSourceId,
    string? ExternalMessageId,
    string InputKind,
    string? RawText,
    JsonElement RawPayload,
    string Status,
    DateTimeOffset ReceivedAt,
    DateTimeOffset? ProcessedAt);

public sealed record CreateNoteAssetRequest(
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

public sealed record CreateNoteTextVersionRequest(
    Guid? SourceRunId,
    string VersionKind,
    string Text,
    string? Language,
    string? Provider,
    string? Model,
    string? PromptVersion);

public sealed record CreateNoteProcessingRunRequest(
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

public sealed record LinkTelegramAccountRequest(
    Guid RequestedByUserId,
    long TelegramUserId,
    string? Username,
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string? LanguageCode,
    bool IsBot);

public sealed record NoteResponse(
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

public sealed record NoteListResponse(
    IReadOnlyList<NoteResponse> Notes);

public sealed record NoteInputResponse(
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

public sealed record NoteAssetResponse(
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

public sealed record NoteTextVersionResponse(
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

public sealed record NoteProcessingRunResponse(
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

public sealed record TelegramAccountResponse(
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

public sealed record UserTelegramAccountResponse(
    Guid Id,
    Guid RequestedByUserId,
    Guid TelegramAccountId,
    DateTimeOffset LinkedAt,
    DateTimeOffset? RevokedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record LinkedTelegramAccountResponse(
    UserTelegramAccountResponse Link,
    TelegramAccountResponse Account);

public sealed record NoteDetailResponse(
    NoteResponse Note,
    IReadOnlyList<NoteInputResponse> Inputs,
    IReadOnlyList<NoteAssetResponse> Assets,
    IReadOnlyList<NoteTextVersionResponse> TextVersions,
    IReadOnlyList<NoteProcessingRunResponse> ProcessingRuns);
