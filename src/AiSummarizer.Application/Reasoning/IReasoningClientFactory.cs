namespace AiSummarizer.Application.Reasoning;

public interface IReasoningClientFactory
{
    IReasoningClient GetClient(ReasoningProvider provider);
}
