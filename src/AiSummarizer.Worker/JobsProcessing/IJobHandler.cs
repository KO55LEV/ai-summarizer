using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Worker.JobsProcessing;

public interface IJobHandler
{
    string JobType { get; }
    Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken);
}
