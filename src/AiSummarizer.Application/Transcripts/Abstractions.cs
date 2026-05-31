using System.Data.Common;
using AiSummarizer.Domain.Transcripts;

namespace AiSummarizer.Application.Transcripts;

public interface ITranscriptsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<ITranscriptsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Transcript> UpsertTranscriptAsync(Transcript transcript, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteTranscriptSegmentsAsync(Guid transcriptId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task CreateTranscriptSegmentsAsync(IReadOnlyList<TranscriptSegment> segments, DbTransaction? transaction, CancellationToken cancellationToken);
}
