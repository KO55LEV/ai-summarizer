using AiSummarizer.Application.Reasoning;
using AiSummarizer.Infrastructure.Reasoning.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Reasoning;

public static class ReasoningServiceCollectionExtensions
{
    public static IServiceCollection AddReasoningAI(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<OpenRouterOptions>().Bind(configuration.GetSection(OpenRouterOptions.SectionName));
        services.AddOptions<OllamaOptions>().Bind(configuration.GetSection(OllamaOptions.SectionName));
        services.AddOptions<InceptionLabsOptions>().Bind(configuration.GetSection(InceptionLabsOptions.SectionName));
        services.AddOptions<GoogleVertexReasoningOptions>().Bind(configuration.GetSection(GoogleVertexReasoningOptions.SectionName));

        services.AddHttpClient<OpenRouterReasoningClient>((sp, client) => client.Timeout = TimeSpan.FromSeconds(sp.GetRequiredService<IOptions<OpenRouterOptions>>().Value.TimeoutSeconds));
        services.AddHttpClient<OllamaReasoningClient>((sp, client) => client.Timeout = TimeSpan.FromSeconds(sp.GetRequiredService<IOptions<OllamaOptions>>().Value.TimeoutSeconds));
        services.AddHttpClient<InceptionLabsReasoningClient>((sp, client) => client.Timeout = TimeSpan.FromSeconds(sp.GetRequiredService<IOptions<InceptionLabsOptions>>().Value.TimeoutSeconds));
        services.AddScoped<GoogleVertexReasoningClient>();
        services.AddScoped<IReasoningClientFactory, ReasoningClientFactory>();
        return services;
    }
}
