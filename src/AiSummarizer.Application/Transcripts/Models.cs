using System.Text.Json;
using AiSummarizer.Application.Workflows;

namespace AiSummarizer.Application.Transcripts;

public sealed record TranscriptSummaryDto(
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

public sealed record ScheduleYoutubeTranscriptCommand(
    Guid? RequestRunId,
    Guid? RequestedByUserId,
    string YoutubeUrl,
    string? Language,
    bool PreferNativeTranscript);

public sealed record TranscriptScheduleResultDto(
    string Status,
    TranscriptSummaryDto? Transcript,
    WorkflowDto? Workflow);

public sealed record UserVideoLibraryDto(
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

public interface ITranscriptSchedulingService
{
    Task<TranscriptScheduleResultDto> ScheduleYoutubeTranscriptAsync(ScheduleYoutubeTranscriptCommand command, CancellationToken cancellationToken);
}
