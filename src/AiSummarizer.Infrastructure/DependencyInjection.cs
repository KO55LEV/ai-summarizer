using AiSummarizer.Application.Users;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.State;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Research;
using AiSummarizer.Application.Projects;
using AiSummarizer.Application.Notes;
using AiSummarizer.Application.Todos;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Application.PublicRequests;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Infrastructure.Email;
using AiSummarizer.Infrastructure.Persistence;
using AiSummarizer.Infrastructure.Billing;
using AiSummarizer.Infrastructure.Settings;
using AiSummarizer.Infrastructure.Storage;
using AiSummarizer.Infrastructure.State;
using AiSummarizer.Infrastructure.MediaSources;
using AiSummarizer.Infrastructure.Research;
using AiSummarizer.Infrastructure.Research.Models;
using AiSummarizer.Infrastructure.Reasoning;
using AiSummarizer.Infrastructure.Jobs;
using AiSummarizer.Infrastructure.Projects;
using AiSummarizer.Infrastructure.Notes;
using AiSummarizer.Infrastructure.Todos;
using AiSummarizer.Infrastructure.Prompts;
using AiSummarizer.Infrastructure.PublicRequests;
using AiSummarizer.Infrastructure.Transcripts;
using AiSummarizer.Infrastructure.Workflows;
using AiSummarizer.Infrastructure.Users;
using AiSummarizer.Infrastructure.Users.ExternalAuth;
using AiSummarizer.Infrastructure.Users.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace AiSummarizer.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString, IConfiguration configuration)
    {
        services.AddSingleton(NpgsqlDataSource.Create(connectionString));
        services.AddSingleton<ISqlScriptLoader, FileSqlScriptLoader>();
        services.AddScoped<IUsersRepository, UsersRepository>();
        services.AddScoped<IBillingRepository, BillingRepository>();
        services.AddScoped<IJobsRepository, JobsRepository>();
        services.AddScoped<IJobsService, JobsService>();
        services.AddScoped<IMediaSourcesRepository, MediaSourcesRepository>();
        services.AddScoped<IPublicRequestRunsRepository, PublicRequestRunsRepository>();
        services.AddScoped<ITranscriptsRepository, TranscriptsRepository>();
        services.AddScoped<IUserVideoLibraryRepository, UserVideoLibraryRepository>();
        services.AddScoped<ITranscriptSchedulingService, TranscriptSchedulingService>();
        services.AddScoped<IResearchRepository, ResearchRepository>();
        services.AddScoped<IProjectsRepository, ProjectsRepository>();
        services.AddScoped<INotesRepository, NotesRepository>();
        services.AddScoped<INoteAssetStorage, LocalNoteAssetStorage>();
        services.AddScoped<ITodosRepository, TodosRepository>();
        services.AddScoped<IAppStateRepository, AppStateRepository>();
        services.AddScoped<ISearchProviderRepository, SearchProvidersRepository>();
        services.AddOptions<ResearchSearchSourceOptions>().Bind(configuration.GetSection("ResearchSearchSources"));
        services.AddOptions<ResearchSynthesisOptions>().Bind(configuration.GetSection(ResearchSynthesisOptions.SectionName));
        services.AddOptions<StorageOptions>().Bind(configuration.GetSection("Storage"));
        services.AddScoped<IPromptsRepository, PromptsRepository>();
        services.AddScoped<IWorkflowsRepository, WorkflowsRepository>();
        services.AddScoped<ISecurePasswordHasher, PasswordHasherAdapter>();
        services.AddSingleton<IRefreshTokenService, RefreshTokenService>();
        services.AddHttpClient<GoogleIdentityVerifier>();
        services.AddHttpClient<FacebookIdentityVerifier>();
        services.AddScoped<IExternalIdentityVerifier, ExternalIdentityVerifier>();
        services.AddScoped<IResearchService, ResearchService>();
        services.AddScoped<IProjectsService, ProjectsService>();
        services.AddScoped<INotesService, NotesService>();
        services.AddScoped<ITodosService, TodosService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<IPromptsService, PromptsService>();
        services.AddScoped<ITranscriptInsightsService, TranscriptInsightsService>();
        services.AddScoped<IAdminUsersService, AdminUsersService>();
        services.AddScoped<IAdminWorkflowCostsService, AdminWorkflowCostsService>();
        services.AddAdminSettings(configuration);
        services.AddEmailing(configuration);
        services.AddHttpClient<TavilySearchProvider>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("AiSummarizer/1.0");
        });
        services.AddScoped<ISearchProvider>(sp => sp.GetRequiredService<TavilySearchProvider>());
        services.AddScoped<WebSearchAdapter>();
        services.AddScoped<NewsSearchAdapter>();
        services.AddScoped<ArchiveSearchAdapter>();
        services.AddScoped<RedditSearchAdapter>();
        services.AddScoped<FinancialSearchAdapter>();
        services.AddScoped<TwitterSearchAdapter>();
        services.AddScoped<YouTubeSearchAdapter>();
        services.AddScoped<IResearchSearchSourceRegistry, ResearchSearchSourceRegistry>();
        services.AddScoped<ISearchQueryPlanner, ResearchQueryPlanner>();
        services.AddReasoningAI(configuration);
        return services;
    }
}
