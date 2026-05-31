using System.Data.Common;
using AiSummarizer.Domain.PublicRequests;

namespace AiSummarizer.Application.PublicRequests;

public interface IPublicRequestRunsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IPublicRequestRunsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<PublicRequestRun> CreatePublicRequestRunAsync(PublicRequestRun requestRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<PublicRequestRun> UpdatePublicRequestRunAsync(PublicRequestRun requestRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<PublicRequestRun?> GetPublicRequestRunByIdAsync(Guid requestRunId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PublicRequestRun>> ListPublicRequestRunsAsync(Guid? requestedByUserId, string? operationName, int limit, int offset, CancellationToken cancellationToken);
}
