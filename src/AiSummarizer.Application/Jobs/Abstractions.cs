using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Application.Jobs;

public interface IJobsRepository
{
    Task<Job> CreateJobAsync(Job job, CancellationToken cancellationToken);
    Task<Job?> GetJobByIdAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Job>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<Job>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobLog>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken);
}

public interface IJobsService
{
    Task<CreateJobResult> CreateJobAsync(CreateJobCommand command, CancellationToken cancellationToken);
    Task<JobDto> GetJobAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobDto>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobDto>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<JobLogDto>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken);
}
