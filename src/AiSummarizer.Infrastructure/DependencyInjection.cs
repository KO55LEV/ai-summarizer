using AiSummarizer.Application.Users;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Application.PublicRequests;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Infrastructure.Persistence;
using AiSummarizer.Infrastructure.MediaSources;
using AiSummarizer.Infrastructure.Jobs;
using AiSummarizer.Infrastructure.Prompts;
using AiSummarizer.Infrastructure.PublicRequests;
using AiSummarizer.Infrastructure.Transcripts;
using AiSummarizer.Infrastructure.Workflows;
using AiSummarizer.Infrastructure.Users;
using AiSummarizer.Infrastructure.Users.ExternalAuth;
using AiSummarizer.Infrastructure.Users.Security;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace AiSummarizer.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddSingleton(NpgsqlDataSource.Create(connectionString));
        services.AddSingleton<ISqlScriptLoader, FileSqlScriptLoader>();
        services.AddScoped<IUsersRepository, UsersRepository>();
        services.AddScoped<IJobsRepository, JobsRepository>();
        services.AddScoped<IMediaSourcesRepository, MediaSourcesRepository>();
        services.AddScoped<IPublicRequestRunsRepository, PublicRequestRunsRepository>();
        services.AddScoped<ITranscriptsRepository, TranscriptsRepository>();
        services.AddScoped<ITranscriptSchedulingService, TranscriptSchedulingService>();
        services.AddScoped<IPromptsRepository, PromptsRepository>();
        services.AddScoped<IWorkflowsRepository, WorkflowsRepository>();
        services.AddScoped<ISecurePasswordHasher, PasswordHasherAdapter>();
        services.AddSingleton<IRefreshTokenService, RefreshTokenService>();
        services.AddHttpClient<GoogleIdentityVerifier>();
        services.AddHttpClient<FacebookIdentityVerifier>();
        services.AddScoped<IExternalIdentityVerifier, ExternalIdentityVerifier>();
        services.AddScoped<IPromptsService, PromptsService>();
        return services;
    }
}
