using System.Data.Common;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Domain.Workflows;
using AiSummarizer.Application.Workflows;

namespace AiSummarizer.Application.Transcripts;

public interface ITranscriptsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<ITranscriptsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Transcript> UpsertTranscriptAsync(Transcript transcript, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Transcript?> GetTranscriptBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken);
    Task<Transcript?> GetTranscriptBySourceUrlAsync(string sourceUrl, CancellationToken cancellationToken);
    Task<IReadOnlyList<TranscriptSegment>> GetTranscriptSegmentsByTranscriptIdAsync(Guid transcriptId, CancellationToken cancellationToken);
    Task DeleteTranscriptSegmentsAsync(Guid transcriptId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task CreateTranscriptSegmentsAsync(IReadOnlyList<TranscriptSegment> segments, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface IUserVideoLibraryRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IUserVideoLibraryRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<UserVideoLibraryItem> UpsertUserVideoAsync(UserVideoLibraryItem item, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<int> CompleteByMediaSourceIdAsync(Guid mediaSourceId, Guid transcriptId, DateTimeOffset completedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<int> FailByMediaSourceIdAsync(Guid mediaSourceId, DateTimeOffset failedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserVideoLibraryDto>> ListUserVideosAsync(Guid requestedByUserId, Guid? projectId, string? status, int limit, int offset, CancellationToken cancellationToken);
}

public interface ITranscriptInsightsService
{
    Task<TranscriptInsightScheduleResultDto> CreateInsightWorkflowAsync(CreateTranscriptInsightWorkflowCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowDto>> ListInsightWorkflowsAsync(Guid sourceId, int limit, int offset, CancellationToken cancellationToken);
}
