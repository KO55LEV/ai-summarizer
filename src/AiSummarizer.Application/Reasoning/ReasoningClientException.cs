namespace AiSummarizer.Application.Reasoning;

public sealed class ReasoningClientException : Exception
{
    public ReasoningProvider Provider { get; }

    public ReasoningClientException(ReasoningProvider provider, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        Provider = provider;
    }
}
