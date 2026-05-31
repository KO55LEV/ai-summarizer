using AiSummarizer.Shared;
using AiSummarizer.Api.Middleware;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Users;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Infrastructure;
using Microsoft.Extensions.Options;

EnvironmentBootstrapper.Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.Sources.Clear();
builder.Configuration.AddEnvironmentVariables();
builder.Configuration.AddCommandLine(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.Configure<UsersOptions>(builder.Configuration.GetSection("Users"));
builder.Services.Configure<InternalApiOptions>(builder.Configuration.GetSection("InternalApi"));
builder.Services.AddInfrastructure(
    builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is missing."));
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<UsersOptions>>().Value);
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IJobsService, JobsService>();
builder.Services.AddScoped<IWorkflowsService, WorkflowsService>();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<InternalApiMiddleware>();
app.MapControllers();

app.Run();
