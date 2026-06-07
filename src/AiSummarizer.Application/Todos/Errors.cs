namespace AiSummarizer.Application.Todos;

public sealed class TodoNotFoundException(string message) : Exception(message);
public sealed class TodoValidationException(string message) : Exception(message);
