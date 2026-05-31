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
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ScheduleYoutubeTranscriptCommand(
    Guid? RequestedByUserId,
    string YoutubeUrl,
    string? Language,
    bool PreferNativeTranscript);

public sealed record TranscriptScheduleResultDto(
    string Status,
    TranscriptSummaryDto? Transcript,
    WorkflowDto? Workflow);

public interface ITranscriptSchedulingService
{
    Task<TranscriptScheduleResultDto> ScheduleYoutubeTranscriptAsync(ScheduleYoutubeTranscriptCommand command, CancellationToken cancellationToken);
}
