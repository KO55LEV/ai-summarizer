namespace AiSummarizer.Infrastructure.Email;

public sealed class EmailSendException : Exception
{
    public EmailSendException(string provider, int statusCode, string details)
        : base($"Email send via {provider} failed with status code {statusCode}: {details}")
    {
        Provider = provider;
        StatusCode = statusCode;
        Details = details;
    }

    public string Provider { get; }

    public int StatusCode { get; }

    public string Details { get; }
}
