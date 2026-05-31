using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Domain.Jobs;

namespace AiSummarizer.Worker.JobsProcessing;

public sealed class JobExecutionContext
{
    private readonly IJobsRepository _repository;
    private readonly object _gate = new();
    private short? _progressPercent;
    private string? _progressMessage;

    public JobExecutionContext(IJobsRepository repository, Job job, string workerId, short? progressPercent, string? progressMessage)
    {
        _repository = repository;
        Job = job;
        WorkerId = workerId;
        _progressPercent = progressPercent;
        _progressMessage = progressMessage;
    }

    public Job Job { get; }
    public string WorkerId { get; }

    public Task LogInfoAsync(string message, JsonElement? context, CancellationToken cancellationToken)
        => _repository.AddLogAsync(Job.Id, Job.AttemptCount, "info", message, context, cancellationToken);

    public Task LogWarningAsync(string message, JsonElement? context, CancellationToken cancellationToken)
        => _repository.AddLogAsync(Job.Id, Job.AttemptCount, "warning", message, context, cancellationToken);

    public Task LogErrorAsync(string message, JsonElement? context, CancellationToken cancellationToken)
        => _repository.AddLogAsync(Job.Id, Job.AttemptCount, "error", message, context, cancellationToken);

    public void ReportProgress(short? percent, string? message)
    {
        lock (_gate)
        {
            _progressPercent = percent;
            _progressMessage = message;
        }
    }

    public (short? Percent, string? Message) SnapshotProgress()
    {
        lock (_gate)
        {
            return (_progressPercent, _progressMessage);
        }
    }
}
