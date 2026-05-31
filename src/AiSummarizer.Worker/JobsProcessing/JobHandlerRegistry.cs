namespace AiSummarizer.Worker.JobsProcessing;

public sealed class JobHandlerRegistry(IEnumerable<IJobHandler> handlers) : IJobHandlerRegistry
{
    private readonly IReadOnlyDictionary<string, IJobHandler> _handlers =
        handlers.ToDictionary(handler => handler.JobType, StringComparer.OrdinalIgnoreCase);

    public IJobHandler? Resolve(string jobType)
        => _handlers.TryGetValue(jobType, out var handler) ? handler : null;
}
