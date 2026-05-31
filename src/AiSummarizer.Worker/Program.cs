using AiSummarizer.Shared;
using AiSummarizer.Infrastructure;
using AiSummarizer.Worker;
using AiSummarizer.Worker.JobsProcessing;
using AiSummarizer.Worker.JobsProcessing.Handlers;

EnvironmentBootstrapper.Load();

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<WorkerOptions>(builder.Configuration.GetSection("Worker"));
builder.Services.Configure<YouTubeDownloadOptions>(builder.Configuration.GetSection("Jobs:YouTubeDownload"));
builder.Services.Configure<MediaExtractAudioOptions>(builder.Configuration.GetSection("Jobs:MediaExtractAudio"));
builder.Services.Configure<WhisperTranscribeOptions>(builder.Configuration.GetSection("Jobs:WhisperTranscribe"));
builder.Services.AddInfrastructure(
    builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is missing."));
builder.Services.AddSingleton<IJobHandlerRegistry, JobHandlerRegistry>();
builder.Services.AddSingleton<IJobHandler, YouTubeDownloadJobHandler>();
builder.Services.AddSingleton<IJobHandler, MediaExtractAudioJobHandler>();
builder.Services.AddSingleton<IJobHandler, WhisperTranscribeJobHandler>();
builder.Services.AddSingleton<IJobHandler, TranscriptImportJobHandler>();
builder.Services.AddHostedService<JobsProcessorHostedService>();

var host = builder.Build();
await host.RunAsync();
