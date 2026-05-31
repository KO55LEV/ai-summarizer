namespace AiSummarizer.Application.Prompts;

public abstract class PromptsException(string message) : Exception(message);

public sealed class PromptNotFoundException(string message) : PromptsException(message);
public sealed class PromptConflictException(string message) : PromptsException(message);
