using AiSummarizer.Application.Jobs;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Jobs;

[ApiController]
[Route("internal/jobs")]
public sealed class JobsController(IJobsService jobsService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CreateJobResponse>> Create([FromBody] CreateJobRequest request, CancellationToken cancellationToken)
        => Ok(new CreateJobResponse(Map(await jobsService.CreateJobAsync(
            new CreateJobCommand(
                request.JobType,
                request.Payload,
                request.Priority ?? 100,
                request.RequestedByUserId,
                request.ParentJobId,
                request.MaxAttempts ?? 5),
            cancellationToken))));

    [HttpGet("{jobId:guid}")]
    public async Task<ActionResult<JobResponse>> GetById([FromRoute] Guid jobId, CancellationToken cancellationToken)
        => Ok(Map(await jobsService.GetJobAsync(jobId, cancellationToken)));

    [HttpGet("active")]
    public async Task<ActionResult<IReadOnlyList<JobResponse>>> GetActive([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await jobsService.ListActiveJobsAsync(limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<JobResponse>>> GetHistory([FromQuery] int limit = 50, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await jobsService.ListHistoryJobsAsync(limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpGet("{jobId:guid}/logs")]
    public async Task<ActionResult<IReadOnlyList<JobLogResponse>>> GetLogs([FromRoute] Guid jobId, [FromQuery] int limit = 100, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
        => Ok((await jobsService.ListLogsAsync(jobId, limit, offset, cancellationToken)).Select(Map).ToArray());

    private static JobResponse Map(JobDto job)
        => new(
            job.Id,
            job.ParentJobId,
            job.RequestedByUserId,
            job.JobType,
            job.Priority,
            job.Status,
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

    private static JobResponse Map(CreateJobResult result) => Map(result.Job);

    private static JobLogResponse Map(JobLogDto log)
        => new(log.Id, log.JobId, log.AttemptNo, log.Level, log.Message, log.Context, log.CreatedAt);
}
