using AiSummarizer.Application.Emails;
using AiSummarizer.Infrastructure.Email.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Email;

public static class EmailServiceCollectionExtensions
{
    public static IServiceCollection AddEmailing(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<EmailOptions>().Bind(configuration.GetSection(EmailOptions.SectionName));
        services.AddOptions<BrevoEmailOptions>().Bind(configuration.GetSection(BrevoEmailOptions.SectionName));

        services.AddHttpClient<BrevoEmailSender>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<BrevoEmailOptions>>().Value;
            client.BaseAddress = new Uri(options.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        });

        services.AddScoped<IEmailSender, EmailSender>();
        return services;
    }
}
