using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Application.Jobs;

public sealed class JobsService(IJobsRepository repository) : IJobsService
{
    public async Task<CreateJobResult> CreateJobAsync(CreateJobCommand command, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var created = await repository.CreateJobAsync(new Job
        {
            JobType = command.JobType.Trim(),
            Payload = command.Payload,
            Priority = command.Priority,
            RequestedByUserId = command.RequestedByUserId,
            ParentJobId = command.ParentJobId,
            MaxAttempts = command.MaxAttempts,
            Status = JobStatus.Queued,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        return new CreateJobResult(Map(created));
    }

    public async Task<JobDto> GetJobAsync(Guid jobId, CancellationToken cancellationToken)
        => Map(await repository.GetJobByIdAsync(jobId, cancellationToken) ?? throw new JobNotFoundException("Job not found."));

    public async Task<IReadOnlyList<JobDto>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListActiveJobsAsync(limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<JobDto>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListHistoryJobsAsync(limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<JobLogDto>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListLogsAsync(jobId, limit, offset, cancellationToken)).Select(Map).ToArray();

    private static JobDto Map(Job job)
        => new(
            job.Id,
            job.ParentJobId,
            job.RequestedByUserId,
            job.JobType,
            job.Priority,
            job.Status.ToString().ToLowerInvariant(),
            job.Payload,
            job.Result,
            job.ErrorCode,
            job.ErrorMessage,
            job.ErrorDetails,
            job.AttemptCount,
            job.MaxAttempts,
            job.AvailableAt,
            job.LockedBy,
            job.LockedAt,
            job.LockedUntil,
            job.StartedAt,
            job.FinishedAt,
            job.LastErrorAt,
            job.CreatedAt,
            job.UpdatedAt);

    private static JobLogDto Map(JobLog log)
        => new(
            log.Id,
            log.JobId,
            log.AttemptNo,
            log.Level,
            log.Message,
            log.Context,
            log.CreatedAt);
}
