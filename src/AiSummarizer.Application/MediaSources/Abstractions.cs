using System.Data.Common;
using AiSummarizer.Domain.MediaSources;

namespace AiSummarizer.Application.MediaSources;

public interface IMediaSourcesRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IMediaSourcesRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<MediaSource> UpsertMediaSourceAsync(MediaSource mediaSource, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<MediaSource?> GetMediaSourceByIdAsync(Guid sourceId, CancellationToken cancellationToken);
    Task<MediaSource?> GetMediaSourceByIdentityAsync(string sourceProvider, string sourceKind, string externalSourceId, CancellationToken cancellationToken);
}
