using System.Text.Json;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Application.Jobs;

public interface IJobsRepository
{
    Task<Job> CreateJobAsync(Job job, CancellationToken cancellationToken);
    Task<Job?> GetJobByIdAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Job>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<Job>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobLog>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken);
    Task<Job?> ClaimNextJobAsync(string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken);
    Task<bool> HeartbeatJobAsync(Guid jobId, string workerId, short? progressPercent, string? progressMessage, TimeSpan leaseDuration, CancellationToken cancellationToken);
    Task<bool> CompleteJobAsync(Guid jobId, string workerId, JsonElement? result, CancellationToken cancellationToken);
    Task<bool> FailJobAsync(Guid jobId, string workerId, string errorCode, string errorMessage, JsonElement? errorDetails, bool deadLetter, TimeSpan retryDelay, CancellationToken cancellationToken);
    Task<bool> CancelJobAsync(Guid jobId, string workerId, string reason, CancellationToken cancellationToken);
    Task<bool> RequestCancelAsync(Guid jobId, CancellationToken cancellationToken);
    Task<JobLog> AddLogAsync(Guid jobId, int? attemptNo, string level, string message, JsonElement? context, CancellationToken cancellationToken);
}

public interface IJobsService
{
    Task<CreateJobResult> CreateJobAsync(CreateJobCommand command, CancellationToken cancellationToken);
    Task<JobDto> GetJobAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobDto>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobDto>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobLogDto>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken);
    Task<bool> RequestCancelAsync(Guid jobId, CancellationToken cancellationToken);
}
