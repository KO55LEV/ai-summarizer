namespace AiSummarizer.Worker.JobsProcessing;

public interface IJobHandlerRegistry
{
    IJobHandler? Resolve(string jobType);
}
