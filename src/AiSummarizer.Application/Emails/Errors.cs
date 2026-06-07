namespace AiSummarizer.Application.Emails;

public abstract class EmailTemplatesException(string message) : Exception(message);

public sealed class EmailTemplateConflictException(string message) : EmailTemplatesException(message);

public sealed class EmailTemplateNotFoundException(string message) : EmailTemplatesException(message);
