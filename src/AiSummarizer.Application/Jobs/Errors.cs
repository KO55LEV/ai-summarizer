namespace AiSummarizer.Application.Jobs;

public abstract class JobsException : Exception
{
    protected JobsException(string message) : base(message) { }
}

public sealed class JobNotFoundException : JobsException
{
    public JobNotFoundException(string message) : base(message) { }
}
