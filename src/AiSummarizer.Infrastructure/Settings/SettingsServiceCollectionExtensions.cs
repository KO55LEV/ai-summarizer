using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Settings.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AiSummarizer.Infrastructure.Settings;

public static class SettingsServiceCollectionExtensions
{
    public static IServiceCollection AddAdminSettings(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<EmailRuntimeDefaultsOptions>().Bind(configuration.GetSection(EmailRuntimeDefaultsOptions.SectionName));
        services.AddOptions<TranscribeRuntimeDefaultsOptions>().Bind(configuration.GetSection(TranscribeRuntimeDefaultsOptions.SectionName));
        services.AddScoped<IUpSettingsRepository, UpSettingsRepository>();
        services.AddScoped<IAdminSettingsService, AdminSettingsService>();
        return services;
    }
}
