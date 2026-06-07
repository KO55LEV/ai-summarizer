using System.Text.Json;

namespace AiSummarizer.Api.Transcripts;

public sealed record ScheduleYoutubeTranscriptRequest(
    Guid? RequestedByUserId,
    string YoutubeUrl,
    string? Language,
    bool? PreferNativeTranscript);

public sealed record TranscriptSummaryResponse(
    Guid Id,
    Guid JobId,
    Guid? SourceId,
    Guid? SourceJobId,
    string? SourceUrl,
    string? SourceFilePath,
    string TranscriptFilePath,
    string Language,
    decimal LanguageProbability,
    decimal DurationSeconds,
    int SegmentCount,
    int WordCount,
    int CharacterCount,
    string TranscriptText,
    string CleanText,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TranscriptScheduleResponse(
    Guid RequestId,
    string Status,
    TranscriptSummaryResponse? Transcript,
    AiSummarizer.Api.Workflows.WorkflowResponse? Workflow);

public sealed record UserVideoLibraryItemResponse(
    Guid Id,
    Guid RequestedByUserId,
    Guid MediaSourceId,
    Guid? PublicRequestRunId,
    Guid? WorkflowId,
    Guid? TranscriptId,
    string Status,
    string SourceProvider,
    string SourceKind,
    string ExternalSourceId,
    string SourceUrl,
    string? Language,
    decimal? DurationSeconds,
    DateTimeOffset? CompletedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record PublicRequestRunResponse(
    Guid Id,
    Guid? RequestedByUserId,
    string ApiArea,
    string OperationName,
    string HttpMethod,
    string RequestPath,
    Guid? SourceId,
    string? SourceProvider,
    string? SourceKind,
    string? ExternalSourceId,
    string? SourceUrl,
    Guid? WorkflowId,
    Guid? TranscriptId,
    JsonElement Request,
    JsonElement? Response,
    string Status,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TranscriptHistoryItemResponse(
    Guid RequestId,
    Guid? SourceId,
    string? SourceProvider,
    string? SourceKind,
    string? ExternalSourceId,
    string? SourceUrl,
    Guid? WorkflowId,
    Guid? TranscriptId,
    string Status,
    string DisplayStatus,
    string? SourceLabel,
    string? Language,
    decimal? DurationSeconds,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset CreatedAt);
