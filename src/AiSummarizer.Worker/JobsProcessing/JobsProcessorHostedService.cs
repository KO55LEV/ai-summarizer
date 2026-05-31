using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.JobsProcessing;

public sealed class JobsProcessorHostedService(
    IJobsRepository repository,
    IJobHandlerRegistry handlerRegistry,
    IOptions<WorkerOptions> options,
    ILogger<JobsProcessorHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var workerOptions = options.Value;
        var activeJobs = new List<Task>();
        var pollDelay = TimeSpan.FromMilliseconds(workerOptions.PollIntervalMilliseconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            activeJobs.RemoveAll(task => task.IsCompleted);

            while (activeJobs.Count < workerOptions.MaxConcurrentJobs && !stoppingToken.IsCancellationRequested)
            {
                var job = await repository.ClaimNextJobAsync(workerOptions.WorkerId, TimeSpan.FromSeconds(workerOptions.LeaseSeconds), stoppingToken);
                if (job is null)
                {
                    break;
                }

                activeJobs.Add(RunJobAsync(job, workerOptions, stoppingToken));
            }

            if (activeJobs.Count == 0)
            {
                await Task.Delay(pollDelay, stoppingToken);
                continue;
            }

            var delayTask = Task.Delay(pollDelay, stoppingToken);
            await Task.WhenAny(activeJobs.Append(delayTask));
        }
    }

    private async Task RunJobAsync(Job job, WorkerOptions workerOptions, CancellationToken stoppingToken)
    {
        using var handlerCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        var context = new JobExecutionContext(repository, job, workerOptions.WorkerId, job.ProgressPercent, job.ProgressMessage);
        var heartbeatTask = HeartbeatLoopAsync(job, workerOptions, context, handlerCts, stoppingToken);

        try
        {
            var handler = handlerRegistry.Resolve(job.JobType);
            if (handler is null)
            {
                await repository.FailJobAsync(job.Id, workerOptions.WorkerId, "unsupported_job_type", $"No handler registered for job type '{job.JobType}'.", null, true, TimeSpan.Zero, stoppingToken);
                return;
            }

            await context.LogInfoAsync($"Starting job {job.JobType}", null, stoppingToken);
            var result = await handler.HandleAsync(context, handlerCts.Token);
            if (result.IsDeadLetter)
            {
                await repository.FailJobAsync(job.Id, workerOptions.WorkerId, result.ErrorCode ?? "job_failed", result.ErrorMessage ?? "Job failed.", result.ErrorDetails, true, TimeSpan.Zero, stoppingToken);
                return;
            }

            if (result.ErrorCode is not null || result.ErrorMessage is not null)
            {
                await repository.FailJobAsync(job.Id, workerOptions.WorkerId, result.ErrorCode ?? "job_failed", result.ErrorMessage ?? "Job failed.", result.ErrorDetails, false, result.RetryDelay, stoppingToken);
                return;
            }

            await repository.CompleteJobAsync(job.Id, workerOptions.WorkerId, result.Result, stoppingToken);
            await context.LogInfoAsync("Job completed", null, stoppingToken);
        }
        catch (OperationCanceledException) when (handlerCts.IsCancellationRequested)
        {
            if (!stoppingToken.IsCancellationRequested)
            {
                await repository.CancelJobAsync(job.Id, workerOptions.WorkerId, "cancelled", stoppingToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Job {JobId} failed", job.Id);
            await repository.FailJobAsync(job.Id, workerOptions.WorkerId, "unhandled_exception", ex.Message, JsonSerializer.SerializeToElement(new { exception = ex.GetType().FullName, stackTrace = ex.StackTrace }), false, TimeSpan.FromSeconds(30), stoppingToken);
        }
        finally
        {
            handlerCts.Cancel();
            try
            {
                await heartbeatTask;
            }
            catch
            {
                // heartbeat loop is best-effort
            }
        }
    }

    private async Task HeartbeatLoopAsync(Job job, WorkerOptions workerOptions, JobExecutionContext context, CancellationTokenSource handlerCts, CancellationToken stoppingToken)
    {
        var heartbeatPeriod = TimeSpan.FromSeconds(Math.Max(1, workerOptions.HeartbeatSeconds));
        using var timer = new PeriodicTimer(heartbeatPeriod);
        using var heartbeatCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, handlerCts.Token);

        while (await timer.WaitForNextTickAsync(heartbeatCts.Token) && !handlerCts.IsCancellationRequested)
        {
            var latest = await repository.GetJobByIdAsync(job.Id, stoppingToken);
            if (latest?.CancelRequestedAt is not null)
            {
                handlerCts.Cancel();
                return;
            }

            var progress = context.SnapshotProgress();
            var ok = await repository.HeartbeatJobAsync(job.Id, workerOptions.WorkerId, progress.Percent, progress.Message, TimeSpan.FromSeconds(workerOptions.LeaseSeconds), stoppingToken);
            if (!ok)
            {
                handlerCts.Cancel();
                return;
            }
        }
    }
}
