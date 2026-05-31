namespace AiSummarizer.Application.Workflows;

public abstract class WorkflowsException(string message) : Exception(message);

public sealed class WorkflowNotFoundException(string message) : WorkflowsException(message);
