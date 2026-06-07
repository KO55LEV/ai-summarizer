using System.Data.Common;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Domain.Workflows;

namespace AiSummarizer.Application.Transcripts;

public interface ITranscriptsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<ITranscriptsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Transcript> UpsertTranscriptAsync(Transcript transcript, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Transcript?> GetTranscriptBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken);
    Task<Transcript?> GetTranscriptBySourceUrlAsync(string sourceUrl, CancellationToken cancellationToken);
    Task DeleteTranscriptSegmentsAsync(Guid transcriptId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task CreateTranscriptSegmentsAsync(IReadOnlyList<TranscriptSegment> segments, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface IUserVideoLibraryRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IUserVideoLibraryRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<UserVideoLibraryItem> UpsertUserVideoAsync(UserVideoLibraryItem item, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<int> CompleteByMediaSourceIdAsync(Guid mediaSourceId, Guid transcriptId, DateTimeOffset completedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<int> FailByMediaSourceIdAsync(Guid mediaSourceId, DateTimeOffset failedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserVideoLibraryDto>> ListUserVideosAsync(Guid requestedByUserId, string? status, int limit, int offset, CancellationToken cancellationToken);
}
