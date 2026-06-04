using AiSummarizer.Application.Reasoning;

namespace AiSummarizer.Infrastructure.Reasoning;

internal sealed class ReasoningClientFactory(IServiceProvider serviceProvider) : IReasoningClientFactory
{
    public IReasoningClient GetClient(ReasoningProvider provider) => provider switch
    {
        ReasoningProvider.OpenRouter => serviceProvider.GetRequiredService<OpenRouterReasoningClient>(),
        ReasoningProvider.GoogleVertex => serviceProvider.GetRequiredService<GoogleVertexReasoningClient>(),
        ReasoningProvider.InceptionLabs => serviceProvider.GetRequiredService<InceptionLabsReasoningClient>(),
        ReasoningProvider.Ollama => serviceProvider.GetRequiredService<OllamaReasoningClient>(),
        _ => throw new ReasoningClientException(provider, $"No reasoning client registered for provider {provider}.")
    };
}
