namespace AiSummarizer.Application.Reasoning;

public interface IReasoningClient
{
    ReasoningProvider Provider { get; }
    Task<ReasoningResponse> CompleteAsync(ReasoningRequest request, CancellationToken cancellationToken = default);
    Task<IEnumerable<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default);
}
