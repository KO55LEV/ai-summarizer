using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Application.Reasoning;
using AiSummarizer.Application.Settings;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Domain.Prompts;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Domain.Workflows;
using AiSummarizer.Worker.JobsProcessing.Handlers;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.Workflows;

public sealed class WorkflowProcessorHostedService(
    IBillingService billingService,
    IMediaSourcesRepository mediaSourcesRepository,
    ITranscriptsRepository transcriptsRepository,
    IPromptsRepository promptsRepository,
    IWorkflowsRepository workflowsRepository,
    IJobsRepository jobsRepository,
    IUserVideoLibraryRepository userVideoLibraryRepository,
    IAdminSettingsService adminSettingsService,
    IReasoningClientFactory reasoningClientFactory,
    IOptions<WorkflowOptions> options,
    IOptions<YouTubeDownloadOptions> youtubeDownloadOptions,
    IOptions<WhisperTranscribeOptions> whisperTranscribeOptions,
    ILogger<WorkflowProcessorHostedService> logger) : BackgroundService
{
    private static readonly Regex VttTimestampRegex = new(@"^(?<start>\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(?<end>\d{2}:\d{2}:\d{2}\.\d{3})", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private const int InsightTranscriptMaxCharacters = 24_000;
    private const int AskTranscriptMaxCharacters = 3_600;
    private static readonly HashSet<string> SupportedWorkflowTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "youtube.summary",
        "youtube.transcript",
        "youtube.summary.quick_summary",
        "youtube.summary.key_takeaways",
        "youtube.summary.ask_this_video",
        "youtube.summary.study_guide"
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var workerId = Environment.MachineName + "-workflow";
        var workflowOptions = options.Value;
        var pollInterval = TimeSpan.FromSeconds(Math.Max(1, workflowOptions.PollIntervalSeconds));
        var leaseDuration = TimeSpan.FromSeconds(Math.Max(30, workflowOptions.LeaseSeconds));

        Directory.CreateDirectory(workflowOptions.OutputDirectory);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var workflow = await workflowsRepository.ClaimNextWorkflowAsync(workerId, leaseDuration, stoppingToken);
                if (workflow is null)
                {
                    await Task.Delay(pollInterval, stoppingToken);
                    continue;
                }

                await ProcessWorkflowAsync(workflow, workerId, leaseDuration, workflowOptions, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Workflow processor loop failed");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ProcessWorkflowAsync(Workflow workflow, string workerId, TimeSpan leaseDuration, WorkflowOptions workflowOptions, CancellationToken cancellationToken)
    {
        if (IsInsightWorkflowType(workflow.WorkflowType))
        {
            await ProcessInsightWorkflowAsync(workflow, workerId, leaseDuration, cancellationToken);
            return;
        }

        if (!SupportedWorkflowTypes.Contains(workflow.WorkflowType))
        {
            await workflowsRepository.AddWorkflowEventAsync(workflow.Id, workflow.CurrentStepKey, "warning", "Unsupported workflow type.", JsonSerializer.SerializeToElement(new { workflow.WorkflowType }), null, cancellationToken);
            workflow = workflow with
            {
                Status = "dead",
                ErrorCode = "unsupported_workflow_type",
                ErrorMessage = $"Unsupported workflow type: {workflow.WorkflowType}",
                LockedBy = null,
                LockedAt = null,
                LockedUntil = null,
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            await workflowsRepository.UpdateWorkflowAsync(workflow, null, cancellationToken);
            if (workflow.SourceId is not null)
            {
                await userVideoLibraryRepository.FailByMediaSourceIdAsync(workflow.SourceId.Value, DateTimeOffset.UtcNow, null, cancellationToken);
            }
            await ReleaseWorkflowBillingAsync(workflow, "Unsupported workflow type.", cancellationToken);
            return;
        }

        var input = workflow.Input;
        var sourceId = workflow.SourceId ?? ReadGuid(input, "sourceId");
        var preferredLanguage = ReadString(input, "language") ?? whisperTranscribeOptions.Value.Language;
        var preferNativeTranscript = ReadBool(input, "preferNativeTranscript", true);
        var workflowRootDirectory = GetWorkflowRootDirectory(workflowOptions.OutputDirectory, workflow.Id);

        if (sourceId is null)
        {
            await FailWorkflowAsync(workflow, "invalid_input", "Workflow input is missing sourceId.", cancellationToken);
            return;
        }

        var mediaSource = await mediaSourcesRepository.GetMediaSourceByIdAsync(sourceId.Value, cancellationToken);
        if (mediaSource is null)
        {
            await FailWorkflowAsync(workflow, "source_not_found", $"Media source {sourceId.Value} was not found.", cancellationToken);
            return;
        }

        var sourceIdentity = new MediaSourceIdentity(
            mediaSource.SourceProvider,
            mediaSource.SourceKind,
            mediaSource.ExternalSourceId,
            mediaSource.CanonicalUrl,
            mediaSource.OriginalUrl);
        var sourceUrl = mediaSource.CanonicalUrl;
        var runtimeSettings = await adminSettingsService.GetAsync(cancellationToken);
        var transcribeProvider = runtimeSettings.Transcribe.Provider;

        var currentStep = await GetLatestStepAsync(workflow.Id, cancellationToken);
        if (currentStep is null)
        {
            await StartWorkflowAsync(workflow, mediaSource, sourceIdentity, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, transcribeProvider, cancellationToken);
            return;
        }

        if (currentStep.JobId is not null)
        {
            var job = await jobsRepository.GetJobByIdAsync(currentStep.JobId.Value, cancellationToken);
            if (job is null)
            {
                await FailWorkflowAsync(workflow, "job_missing", $"Workflow step {currentStep.StepKey} references a missing job.", cancellationToken);
                return;
            }

            if (!IsTerminal(job.Status))
            {
                await workflowsRepository.HeartbeatWorkflowAsync(workflow.Id, workerId, job.ProgressPercent, job.ProgressMessage, leaseDuration, cancellationToken);
                workflow = workflow with
                {
                    Status = "waiting",
                    CurrentStepKey = currentStep.StepKey,
                    ProgressPercent = job.ProgressPercent,
                    ProgressMessage = job.ProgressMessage,
                    LockedBy = null,
                    LockedAt = null,
                    LockedUntil = null,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                await workflowsRepository.UpdateWorkflowAsync(workflow, null, cancellationToken);
                return;
            }

            if (job.Status is JobStatus.Succeeded)
            {
                await HandleSucceededStepAsync(workflow, currentStep, job, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, transcribeProvider, workerId, leaseDuration, cancellationToken);
                return;
            }

            await FailWorkflowAsync(workflow, job.ErrorCode ?? "job_failed", job.ErrorMessage ?? $"Job {job.Id} failed.", cancellationToken);
            return;
        }

            if (currentStep.Status == "succeeded" && string.Equals(currentStep.StepKey, "native_transcript_check", StringComparison.OrdinalIgnoreCase))
            {
                var output = currentStep.Output;
                var available = output.HasValue && output.Value.ValueKind == JsonValueKind.Object && output.Value.TryGetProperty("available", out var availableProperty) && availableProperty.GetBoolean();
                if (available)
                {
                    var transcriptFilePath = output.Value!.GetProperty("transcriptFilePath").GetString();
                    await CreateImportTranscriptJobAsync(workflow, currentStep, transcriptFilePath, null, sourceUrl, preferredLanguage, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
                    return;
                }

                await CreateDownloadJobAsync(workflow, currentStep, sourceUrl, preferredLanguage, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
                return;
            }

        await StartWorkflowAsync(workflow, mediaSource, sourceIdentity, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, transcribeProvider, cancellationToken);
    }

    private async Task StartWorkflowAsync(Workflow workflow, MediaSource mediaSource, MediaSourceIdentity sourceIdentity, string sourceUrl, string? preferredLanguage, bool preferNativeTranscript, string workflowRootDirectory, string transcribeProvider, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflow.Id,
            StepOrder = 0,
            StepKey = "native_transcript_check",
            StepType = "native_check",
            JobId = null,
            Status = "running",
            Input = JsonSerializer.SerializeToElement(new
            {
                sourceId = workflow.SourceId,
                sourceProvider = sourceIdentity.SourceProvider,
                sourceKind = sourceIdentity.SourceKind,
                sourceExternalId = sourceIdentity.ExternalSourceId,
                language = preferredLanguage,
                preferNativeTranscript
            }),
            Output = null,
            StartedAt = now,
            FinishedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        workflow = workflow with
        {
            Status = "running",
            CurrentStepKey = step.StepKey,
            AttemptCount = workflow.AttemptCount + 1,
            StartedAt = workflow.StartedAt ?? now,
            ProgressPercent = 5,
            ProgressMessage = "Checking for native transcript",
            LockedBy = Environment.MachineName + "-workflow",
            LockedAt = now,
            LockedUntil = now.AddSeconds(Math.Max(30, options.Value.LeaseSeconds)),
            HeartbeatAt = now,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Checking for native transcript.", JsonSerializer.SerializeToElement(new { sourceId = workflow.SourceId, preferredLanguage }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        if (!preferNativeTranscript)
        {
            var skippedStep = step with
            {
                Status = "skipped",
                Output = JsonSerializer.SerializeToElement(new
                {
                    available = false,
                    skipped = true,
                    sourceUrl
                }),
                FinishedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.UpdateWorkflowStepAsync(skippedStep, transaction, cancellationToken);
                await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Native transcript check skipped by workflow input.", JsonSerializer.SerializeToElement(new { sourceId = workflow.SourceId }), transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            await CreateDownloadJobAsync(workflow, skippedStep, sourceUrl, preferredLanguage, workflowRootDirectory, Environment.MachineName + "-workflow", TimeSpan.FromSeconds(Math.Max(30, options.Value.LeaseSeconds)), cancellationToken);
            return;
        }

        NativeTranscriptResult nativeResult;
        try
        {
            nativeResult = await TryBuildNativeTranscriptAsync(workflow.Id, sourceUrl, preferredLanguage, workflowRootDirectory, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Native transcript check failed; falling back to manual pipeline.");
            nativeResult = NativeTranscriptResult.NotAvailable();
        }

        var completedStep = step with
        {
            Status = "succeeded",
            Output = JsonSerializer.SerializeToElement(new
            {
                available = nativeResult.Available,
                transcriptFilePath = nativeResult.TranscriptFilePath,
                sourceUrl,
                language = nativeResult.Language,
                durationSeconds = nativeResult.DurationSeconds
            }),
            FinishedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateWorkflowStepAsync(completedStep, transaction, cancellationToken);
            if (nativeResult.Available)
            {
                await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Native transcript found.", JsonSerializer.SerializeToElement(new { nativeResult.TranscriptFilePath, sourceId = workflow.SourceId }), transaction, cancellationToken);
            }
            else
            {
                await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Native transcript not available. Falling back to manual pipeline.", JsonSerializer.SerializeToElement(new { sourceId = workflow.SourceId }), transaction, cancellationToken);
            }
            return 0;
        }, cancellationToken);

        if (nativeResult.Available)
        {
            await UpdateMediaSourceNativeTranscriptAsync(mediaSource, nativeResult, workflow.Id, cancellationToken);
            await CreateImportTranscriptJobAsync(workflow, completedStep, nativeResult.TranscriptFilePath, null, sourceUrl, preferredLanguage, workflowRootDirectory, Environment.MachineName + "-workflow", TimeSpan.FromSeconds(Math.Max(30, options.Value.LeaseSeconds)), cancellationToken);
            return;
        }

        if (preferNativeTranscript)
        {
            await UpdateMediaSourceNativeTranscriptAsync(mediaSource, nativeResult, workflow.Id, cancellationToken);
        }

        await CreateDownloadJobAsync(workflow, completedStep, sourceUrl, preferredLanguage, workflowRootDirectory, Environment.MachineName + "-workflow", TimeSpan.FromSeconds(Math.Max(30, options.Value.LeaseSeconds)), cancellationToken);
    }

    private async Task HandleSucceededStepAsync(Workflow workflow, WorkflowStep currentStep, Job job, string sourceUrl, string? preferredLanguage, bool preferNativeTranscript, string workflowRootDirectory, string transcribeProvider, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        var stepOutput = currentStep.Output ?? job.Result;
        var now = DateTimeOffset.UtcNow;

        var completedStep = currentStep with
        {
            Status = "succeeded",
            Output = stepOutput ?? JsonSerializer.SerializeToElement(new { }),
            FinishedAt = now,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateWorkflowStepAsync(completedStep, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, completedStep.StepKey, "info", $"{completedStep.StepKey} completed.", completedStep.Output ?? JsonSerializer.SerializeToElement(new { jobId = job.Id }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        switch (completedStep.StepKey)
        {
            case "import_transcript":
                await CompleteWorkflowAsync(workflow, completedStep, job, cancellationToken);
                return;
            case "transcribe_audio":
                await CreateImportTranscriptJobAsync(workflow, completedStep, GetString(job.Result, "transcriptFilePath"), GetString(job.Result, "sourceFilePath"), sourceUrl, preferredLanguage, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
                return;
            case "extract_audio":
                await CreateTranscribeJobAsync(workflow, completedStep, GetString(job.Result, "outputFilePath"), sourceUrl, preferredLanguage, workflowRootDirectory, transcribeProvider, workerId, leaseDuration, cancellationToken);
                return;
            case "download_video":
                await CreateExtractAudioJobAsync(workflow, completedStep, GetString(job.Result, "outputFilePath"), sourceUrl, preferredLanguage, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
                return;
            default:
                await FailWorkflowAsync(workflow, "unsupported_step", $"Unsupported workflow step: {completedStep.StepKey}", cancellationToken);
                return;
        }
    }

    private async Task CreateDownloadJobAsync(Workflow workflow, WorkflowStep previousStep, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var stepOutputDirectory = GetStepOutputDirectory(workflowRootDirectory, "download");
        var payload = JsonSerializer.SerializeToElement(new
        {
            url = sourceUrl,
            sourceId = workflow.SourceId,
            outputDirectory = stepOutputDirectory
        });
        var job = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = workflow.RequestedByUserId,
            ParentJobId = null,
            JobType = "youtube.download",
            Priority = 0,
            Payload = payload,
            Result = null,
            Status = JobStatus.Queued,
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflow.Id,
            StepOrder = previousStep.StepOrder + 1,
            StepKey = "download_video",
            StepType = "job",
            JobId = job.Id,
            Status = "waiting",
            Input = payload,
            Output = null,
            StartedAt = now,
            FinishedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        workflow = workflow with
        {
            Status = "waiting",
            CurrentStepKey = step.StepKey,
            ProgressPercent = 15,
            ProgressMessage = "Downloading video",
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Queued video download job.", JsonSerializer.SerializeToElement(new { jobId = job.Id, sourceUrl }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private async Task CreateExtractAudioJobAsync(Workflow workflow, WorkflowStep previousStep, string? videoFilePath, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoFilePath))
        {
            await FailWorkflowAsync(workflow, "missing_video_path", "Video file path is missing after download.", cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var stepOutputDirectory = GetStepOutputDirectory(workflowRootDirectory, "audio");
        var payload = JsonSerializer.SerializeToElement(new
        {
            sourceFilePath = videoFilePath,
            sourceId = workflow.SourceId,
            outputDirectory = stepOutputDirectory,
            audioFormat = "m4a"
        });
        var job = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = workflow.RequestedByUserId,
            ParentJobId = null,
            JobType = "media.extract_audio",
            Priority = 0,
            Payload = payload,
            Result = null,
            Status = JobStatus.Queued,
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflow.Id,
            StepOrder = previousStep.StepOrder + 1,
            StepKey = "extract_audio",
            StepType = "job",
            JobId = job.Id,
            Status = "waiting",
            Input = payload,
            Output = null,
            StartedAt = now,
            FinishedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        workflow = workflow with
        {
            Status = "waiting",
            CurrentStepKey = step.StepKey,
            ProgressPercent = 35,
            ProgressMessage = "Extracting audio",
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Queued audio extraction job.", JsonSerializer.SerializeToElement(new { jobId = job.Id, videoFilePath, sourceUrl }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private async Task CreateTranscribeJobAsync(Workflow workflow, WorkflowStep previousStep, string? audioFilePath, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, string transcribeProvider, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(audioFilePath))
        {
            await FailWorkflowAsync(workflow, "missing_audio_path", "Audio file path is missing after extraction.", cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var stepOutputDirectory = GetStepOutputDirectory(workflowRootDirectory, "transcript");
        var payload = JsonSerializer.SerializeToElement(new
        {
            sourceFilePath = audioFilePath,
            sourceId = workflow.SourceId,
            outputDirectory = stepOutputDirectory,
            language = preferredLanguage
        });
        var jobType = TryResolveTranscribeJobType(transcribeProvider);
        if (jobType is null)
        {
            await FailWorkflowAsync(workflow, "unsupported_transcribe_provider", $"Unsupported transcribe provider: {transcribeProvider}", cancellationToken);
            return;
        }
        var job = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = workflow.RequestedByUserId,
            ParentJobId = null,
            JobType = jobType,
            Priority = 0,
            Payload = payload,
            Result = null,
            Status = JobStatus.Queued,
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflow.Id,
            StepOrder = previousStep.StepOrder + 1,
            StepKey = "transcribe_audio",
            StepType = "job",
            JobId = job.Id,
            Status = "waiting",
            Input = payload,
            Output = null,
            StartedAt = now,
            FinishedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        workflow = workflow with
        {
            Status = "waiting",
            CurrentStepKey = step.StepKey,
            ProgressPercent = 55,
            ProgressMessage = "Transcribing audio",
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", $"Queued {jobType} transcription job.", JsonSerializer.SerializeToElement(new { jobId = job.Id, audioFilePath, sourceUrl, jobType }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private static string? TryResolveTranscribeJobType(string transcribeProvider)
        => transcribeProvider.Trim().ToLowerInvariant() switch
        {
            "whisper" => "whisper.transcribe",
            "openrouter" => "openrouter.transcribe",
            _ => null
        };

    private async Task CreateImportTranscriptJobAsync(Workflow workflow, WorkflowStep previousStep, string? transcriptFilePath, string? sourceFilePath, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(transcriptFilePath))
        {
            await FailWorkflowAsync(workflow, "missing_transcript_path", "Transcript file path is missing.", cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var stepOutputDirectory = GetStepOutputDirectory(workflowRootDirectory, "import");
        var payload = JsonSerializer.SerializeToElement(new
        {
            transcriptFilePath,
            sourceFilePath,
            sourceId = workflow.SourceId,
            outputDirectory = stepOutputDirectory
        });
        var job = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = workflow.RequestedByUserId,
            ParentJobId = null,
            JobType = "transcript.import",
            Priority = 0,
            Payload = payload,
            Result = null,
            Status = JobStatus.Queued,
            AttemptCount = 0,
            MaxAttempts = 3,
            AvailableAt = now,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflow.Id,
            StepOrder = previousStep.StepOrder + 1,
            StepKey = "import_transcript",
            StepType = "job",
            JobId = job.Id,
            Status = "waiting",
            Input = payload,
            Output = null,
            StartedAt = now,
            FinishedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        workflow = workflow with
        {
            Status = "waiting",
            CurrentStepKey = step.StepKey,
            ProgressPercent = 80,
            ProgressMessage = "Importing transcript",
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Queued transcript import job.", JsonSerializer.SerializeToElement(new { jobId = job.Id, transcriptFilePath, sourceFilePath, sourceUrl }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private async Task CompleteWorkflowAsync(Workflow workflow, WorkflowStep completedStep, Job job, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        workflow = workflow with
        {
            Status = "succeeded",
            Result = job.Result,
            CurrentStepKey = completedStep.StepKey,
            ProgressPercent = 100,
            ProgressMessage = "Completed",
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            FinishedAt = now,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, completedStep.StepKey, "info", "Workflow completed.", job.Result ?? JsonSerializer.SerializeToElement(new { workflowId = workflow.Id }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        await SettleWorkflowBillingAsync(workflow, "Workflow completed.", cancellationToken);
    }

    private async Task ProcessInsightWorkflowAsync(Workflow workflow, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        var input = workflow.Input;
        var sourceId = workflow.SourceId ?? ReadGuid(input, "sourceId");
        var transcriptId = ReadGuid(input, "transcriptId");
        var actionKey = NormalizeKey(ReadString(input, "actionKey") ?? workflow.WorkflowType);
        var promptKey = ReadString(input, "promptKey") ?? workflow.WorkflowType;
        var question = ReadString(input, "question");
        var conversationContext = ReadString(input, "conversationContext");

        if (sourceId is null)
        {
            await FailWorkflowAsync(workflow, "invalid_input", "Workflow input is missing sourceId.", cancellationToken);
            return;
        }

        var mediaSource = await mediaSourcesRepository.GetMediaSourceByIdAsync(sourceId.Value, cancellationToken);
        if (mediaSource is null)
        {
            await FailWorkflowAsync(workflow, "source_not_found", $"Media source {sourceId.Value} was not found.", cancellationToken);
            return;
        }

        var transcript = await transcriptsRepository.GetTranscriptBySourceIdAsync(sourceId.Value, cancellationToken);

        if (transcript is null)
        {
            var sourceUrl = mediaSource.CanonicalUrl;
            transcript = await transcriptsRepository.GetTranscriptBySourceUrlAsync(sourceUrl, cancellationToken)
                ?? await transcriptsRepository.GetTranscriptBySourceUrlAsync(mediaSource.OriginalUrl, cancellationToken);
        }

        if (transcript is null)
        {
            await FailWorkflowAsync(workflow, "transcript_not_found", $"Transcript for source {sourceId.Value} was not found.", cancellationToken, markLibraryFailed: false);
            return;
        }

        var prompt = await promptsRepository.GetPromptByKeyAsync(promptKey, cancellationToken);
        if (prompt is null)
        {
            await FailWorkflowAsync(workflow, "prompt_not_found", $"Prompt {promptKey} was not found.", cancellationToken, markLibraryFailed: false);
            return;
        }

        if (!prompt.IsActive)
        {
            await FailWorkflowAsync(workflow, "prompt_inactive", $"Prompt {promptKey} is not active.", cancellationToken, markLibraryFailed: false);
            return;
        }

        var segments = await transcriptsRepository.GetTranscriptSegmentsByTranscriptIdAsync(transcript.Id, cancellationToken);
        var transcriptExcerpt = string.Equals(actionKey, "ask-this-video", StringComparison.OrdinalIgnoreCase)
            ? BuildTranscriptExcerpt(transcript, segments, question, conversationContext)
            : string.Equals(actionKey, "quick-summary", StringComparison.OrdinalIgnoreCase)
                ? transcript.TranscriptText
                : BuildTranscriptOverview(transcript, segments);

        var currentStep = await GetLatestStepAsync(workflow.Id, cancellationToken);
        if (currentStep is null)
        {
            var now = DateTimeOffset.UtcNow;
            var step = new WorkflowStep
            {
                Id = Guid.NewGuid(),
                WorkflowId = workflow.Id,
                StepOrder = 0,
                StepKey = "generate_insight",
                StepType = "llm",
                JobId = null,
                Status = "running",
                Input = BuildInsightRequestJson(workflow, prompt, transcript, mediaSource, actionKey, question, conversationContext, transcriptExcerpt),
                Output = null,
                StartedAt = now,
                FinishedAt = null,
                CreatedAt = now,
                UpdatedAt = now
            };

            workflow = workflow with
            {
                Status = "running",
                CurrentStepKey = step.StepKey,
                ProgressPercent = 20,
                ProgressMessage = $"Generating {FormatInsightLabel(actionKey)}",
                LockedBy = workerId,
                LockedAt = now,
                LockedUntil = now.Add(leaseDuration),
                StartedAt = workflow.StartedAt ?? now,
                HeartbeatAt = now,
                AttemptCount = workflow.AttemptCount + 1,
                UpdatedAt = now
            };

            await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
            {
                await repository.CreateWorkflowStepAsync(step, transaction, cancellationToken);
                await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
                await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", $"Generating {FormatInsightLabel(actionKey)}.", step.Input, transaction, cancellationToken);
                return 0;
            }, cancellationToken);

            currentStep = step;
        }

        var startedAt = DateTimeOffset.UtcNow;
        ReasoningResponse reasoningResponse;
        try
        {
            var client = reasoningClientFactory.GetClient(ParseReasoningProvider(prompt.Provider));
            var systemPrompt = prompt.SystemPrompt.Trim();
            var userPrompt = RenderPrompt(prompt.UserPrompt, transcript, mediaSource, question, conversationContext, transcriptExcerpt);
            reasoningResponse = await client.CompleteAsync(new ReasoningRequest(
                prompt.Model,
                systemPrompt,
                userPrompt,
                null,
                Temperature: 0.2,
                MaxTokens: null,
                ResponseFormat: "json"), cancellationToken);
        }
        catch (ReasoningClientException ex)
        {
            logger.LogWarning(
                ex,
                "Reasoning provider failed for workflow {WorkflowId}, step {StepKey}, provider {Provider}.",
                workflow.Id,
                currentStep.StepKey,
                ex.Provider);
            await FailWorkflowAsync(
                workflow,
                "reasoning_failed",
                "The AI provider request failed. Please try again.",
                cancellationToken,
                markLibraryFailed: false,
                failedStep: currentStep,
                diagnosticContext: JsonSerializer.SerializeToElement(new
                {
                    errorCode = "reasoning_failed",
                    provider = ex.Provider.ToString(),
                    exceptionType = ex.GetType().Name,
                    providerMessage = ex.Message,
                    innerException = ex.InnerException?.Message
                }));
            return;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Unexpected reasoning failure for workflow {WorkflowId}, step {StepKey}.",
                workflow.Id,
                currentStep.StepKey);
            await FailWorkflowAsync(
                workflow,
                "reasoning_failed",
                "Something went wrong while generating the summary.",
                cancellationToken,
                markLibraryFailed: false,
                failedStep: currentStep,
                diagnosticContext: JsonSerializer.SerializeToElement(new
                {
                    errorCode = "reasoning_failed",
                    exceptionType = ex.GetType().Name,
                    exceptionMessage = ex.Message,
                    innerException = ex.InnerException?.Message
                }));
            return;
        }

        JsonElement parsedResult;
        try
        {
            parsedResult = ParseInsightResult(reasoningResponse.Text);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to parse reasoning output for workflow {WorkflowId}, step {StepKey}.",
                workflow.Id,
                currentStep.StepKey);
            await RecordPromptRunAndFailAsync(workflow, currentStep, prompt, transcript, mediaSource, actionKey, question, conversationContext, transcriptExcerpt, startedAt, reasoningResponse, "invalid_llm_output", "The AI response could not be read. Please try again.", cancellationToken);
            return;
        }

        var completedStep = currentStep with
        {
            Status = "succeeded",
            Output = parsedResult,
            FinishedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var workflowResult = parsedResult;
        var runNow = DateTimeOffset.UtcNow;
        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await promptsRepository.CreatePromptRunAsync(new PromptRun
            {
                Id = Guid.NewGuid(),
                PromptId = prompt.Id,
                WorkflowId = workflow.Id,
                StepKey = completedStep.StepKey,
                PromptKey = prompt.PromptKey,
                Title = prompt.Title,
                WorkflowType = prompt.WorkflowType,
                Provider = prompt.Provider,
                Model = reasoningResponse.Model,
                Request = BuildPromptRunRequestJson(workflow, prompt, transcript, mediaSource, actionKey, question, conversationContext, transcriptExcerpt, completedStep.Input),
                Response = BuildPromptRunResponseJson(reasoningResponse),
                Status = "succeeded",
                ErrorCode = null,
                ErrorMessage = null,
                InputTokens = reasoningResponse.Usage?.PromptTokens,
                OutputTokens = reasoningResponse.Usage?.CompletionTokens,
                TotalTokens = reasoningResponse.Usage?.TotalTokens,
                DurationMs = null,
                StartedAt = startedAt,
                FinishedAt = runNow,
                CreatedAt = runNow,
                UpdatedAt = runNow
            }, cancellationToken);

            await repository.UpdateWorkflowStepAsync(completedStep, transaction, cancellationToken);
            await repository.UpdateWorkflowAsync(workflow with
            {
                Status = "succeeded",
                Result = workflowResult,
                CurrentStepKey = completedStep.StepKey,
                ProgressPercent = 100,
                ProgressMessage = $"{FormatInsightLabel(actionKey)} ready",
                LockedBy = null,
                LockedAt = null,
                LockedUntil = null,
                FinishedAt = runNow,
                UpdatedAt = runNow
            }, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, completedStep.StepKey, "info", $"{FormatInsightLabel(actionKey)} completed.", workflowResult, transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        await SettleWorkflowBillingAsync(workflow with { Result = workflowResult, Status = "succeeded", CurrentStepKey = completedStep.StepKey, FinishedAt = runNow }, $"Completed {FormatInsightLabel(actionKey)}.", cancellationToken);
    }

    private async Task FailWorkflowAsync(Workflow workflow, string errorCode, string errorMessage, CancellationToken cancellationToken, bool markLibraryFailed = true, WorkflowStep? failedStep = null, JsonElement? diagnosticContext = null)
    {
        var now = DateTimeOffset.UtcNow;
        workflow = workflow with
        {
            Status = "failed",
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            LockedBy = null,
            LockedAt = null,
            LockedUntil = null,
            FinishedAt = now,
            UpdatedAt = now
        };

        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            if (failedStep is not null)
            {
                await repository.UpdateWorkflowStepAsync(failedStep with
                {
                    Status = "failed",
                    ErrorCode = errorCode,
                    ErrorMessage = errorMessage,
                    FinishedAt = now,
                    UpdatedAt = now
                }, transaction, cancellationToken);
            }

            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, workflow.CurrentStepKey, "error", errorMessage, diagnosticContext ?? JsonSerializer.SerializeToElement(new { errorCode }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        if (markLibraryFailed && workflow.SourceId is not null)
        {
            await userVideoLibraryRepository.FailByMediaSourceIdAsync(workflow.SourceId.Value, now, null, cancellationToken);
        }

        await ReleaseWorkflowBillingAsync(workflow, errorMessage, cancellationToken);
    }

    private async Task SettleWorkflowBillingAsync(Workflow workflow, string? reason, CancellationToken cancellationToken)
    {
        if (workflow.RequestedByUserId is null || workflow.SourceId is null)
        {
            return;
        }

        try
        {
            var reservation = await billingService.GetReservationBySourceAsync(workflow.RequestedByUserId.Value, workflow.WorkflowType, workflow.Id, cancellationToken)
                ?? await billingService.GetReservationBySourceAsync(workflow.RequestedByUserId.Value, workflow.WorkflowType, workflow.SourceId.Value, cancellationToken);
            if (reservation is null)
            {
                return;
            }

            await billingService.SettleAsync(
                new SettleBillingReservationCommand(
                    reservation.Id,
                    reservation.EstimatedCredits,
                    reason),
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to settle billing for workflow {WorkflowId}.", workflow.Id);
        }
    }

    private async Task ReleaseWorkflowBillingAsync(Workflow workflow, string? reason, CancellationToken cancellationToken)
    {
        if (workflow.RequestedByUserId is null || workflow.SourceId is null)
        {
            return;
        }

        try
        {
            var reservation = await billingService.GetReservationBySourceAsync(workflow.RequestedByUserId.Value, workflow.WorkflowType, workflow.Id, cancellationToken)
                ?? await billingService.GetReservationBySourceAsync(workflow.RequestedByUserId.Value, workflow.WorkflowType, workflow.SourceId.Value, cancellationToken);
            if (reservation is null)
            {
                return;
            }

            await billingService.ReleaseAsync(
                new ReleaseBillingReservationCommand(
                    reservation.Id,
                    reason),
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to release billing for workflow {WorkflowId}.", workflow.Id);
        }
    }

    private async Task<WorkflowStep?> GetLatestStepAsync(Guid workflowId, CancellationToken cancellationToken)
    {
        var steps = await workflowsRepository.ListStepsAsync(workflowId, cancellationToken);
        return steps.Count == 0 ? null : steps[^1];
    }

    private async Task<NativeTranscriptResult> TryBuildNativeTranscriptAsync(Guid workflowId, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, CancellationToken cancellationToken)
    {
        var attemptDir = GetStepOutputDirectory(workflowRootDirectory, "native-transcripts");
        Directory.CreateDirectory(attemptDir);

        var executable = youtubeDownloadOptions.Value.YtDlpExecutable;
        var args = new[]
        {
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", "all",
            "--sub-format", "vtt",
            "-o", Path.Combine(attemptDir, "%(id)s.%(ext)s"),
            "--",
            sourceUrl
        };

        var result = await RunProcessAsync(executable, args, cancellationToken);
        if (result.ExitCode != 0)
        {
            return NativeTranscriptResult.NotAvailable();
        }

        var subtitleFile = Directory.GetFiles(attemptDir, "*.vtt", SearchOption.AllDirectories)
            .Concat(Directory.GetFiles(attemptDir, "*.srt", SearchOption.AllDirectories))
            .FirstOrDefault();

        if (subtitleFile is null || !File.Exists(subtitleFile))
        {
            return NativeTranscriptResult.NotAvailable();
        }

        var segments = ParseSubtitleFile(subtitleFile);
        if (segments.Count == 0)
        {
            return NativeTranscriptResult.NotAvailable();
        }

        var transcriptFilePath = Path.Combine(attemptDir, $"{workflowId:N}.json");
        var language = InferLanguageFromFileName(subtitleFile) ?? preferredLanguage;
        var transcriptJson = JsonSerializer.Serialize(new
        {
            language = string.IsNullOrWhiteSpace(language) ? "en" : language,
            languageProbability = 1.0,
            duration = segments.Count == 0 ? 0 : segments[^1].End,
            segments = segments.Select(segment => new
            {
                start = Math.Round(segment.Start, 2),
                end = Math.Round(segment.End, 2),
                text = segment.Text
            })
        }, new JsonSerializerOptions { WriteIndented = true });

        await File.WriteAllTextAsync(transcriptFilePath, transcriptJson, cancellationToken);
        return new NativeTranscriptResult(true, transcriptFilePath, language, segments.Count == 0 ? null : segments[^1].End);
    }

    private static string? InferLanguageFromFileName(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        var parts = name.Split('.');
        return parts.Length > 1 ? parts[^1] : null;
    }

    private static List<SubtitleSegment> ParseSubtitleFile(string subtitleFilePath)
    {
        var lines = File.ReadAllLines(subtitleFilePath);
        var segments = new List<SubtitleSegment>();

        int i = 0;
        while (i < lines.Length)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line) || line.Equals("WEBVTT", StringComparison.OrdinalIgnoreCase))
            {
                i++;
                continue;
            }

            if (line.Contains("-->", StringComparison.Ordinal))
            {
                var match = VttTimestampRegex.Match(line);
                if (match.Success)
                {
                    var start = ParseTimestamp(match.Groups["start"].Value);
                    var end = ParseTimestamp(match.Groups["end"].Value);
                    i++;
                    var text = new StringBuilder();
                    while (i < lines.Length && !string.IsNullOrWhiteSpace(lines[i]))
                    {
                        if (text.Length > 0)
                        {
                            text.Append(' ');
                        }

                        text.Append(lines[i].Trim());
                        i++;
                    }

                    var normalizedText = text.ToString().Trim();
                    if (!string.IsNullOrWhiteSpace(normalizedText))
                    {
                        segments.Add(new SubtitleSegment(start, end, normalizedText));
                    }
                    continue;
                }
            }

            i++;
        }

        return segments;
    }

    private static double ParseTimestamp(string timestamp)
    {
        var normalized = timestamp.Replace(',', '.');
        var parts = normalized.Split(':', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 3 &&
            int.TryParse(parts[0], out var hours) &&
            int.TryParse(parts[1], out var minutes) &&
            double.TryParse(parts[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var seconds))
        {
            return (hours * 3600) + (minutes * 60) + seconds;
        }

        return 0;
    }

    private static async Task<ProcessResult> RunProcessAsync(string executable, IReadOnlyList<string> args, CancellationToken cancellationToken)
    {
        var psi = new ProcessStartInfo
        {
            FileName = executable,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        using var process = Process.Start(psi) ?? throw new InvalidOperationException($"Failed to start process: {executable}");
        var output = new List<string>();
        var errors = new List<string>();

        var stdoutTask = Task.Run(async () =>
        {
            while (!process.StandardOutput.EndOfStream)
            {
                var line = await process.StandardOutput.ReadLineAsync();
                if (line is not null)
                {
                    output.Add(line);
                }
            }
        }, cancellationToken);

        var stderrTask = Task.Run(async () =>
        {
            while (!process.StandardError.EndOfStream)
            {
                var line = await process.StandardError.ReadLineAsync();
                if (line is not null)
                {
                    errors.Add(line);
                }
            }
        }, cancellationToken);

        await process.WaitForExitAsync(cancellationToken);
        await Task.WhenAll(stdoutTask, stderrTask);
        return new ProcessResult(process.ExitCode, output, errors);
    }

    private static bool IsTerminal(JobStatus status) => status is JobStatus.Succeeded or JobStatus.Failed or JobStatus.Cancelled or JobStatus.Dead;

    private static bool IsInsightWorkflowType(string workflowType)
        => workflowType.Trim().StartsWith("youtube.summary.", StringComparison.OrdinalIgnoreCase);

    private static ReasoningProvider ParseReasoningProvider(string provider)
        => Enum.TryParse<ReasoningProvider>(provider, true, out var parsed) ? parsed : ReasoningProvider.OpenRouter;

    private static string FormatInsightLabel(string actionKey)
        => actionKey switch
        {
            "quick-summary" => "quick summary",
            "key-takeaways" => "key takeaways",
            "ask-this-video" => "question answer",
            "study-guide" => "study guide",
            _ => actionKey.Replace('-', ' ')
        };

    private static JsonElement BuildInsightRequestJson(Workflow workflow, Prompt prompt, Domain.Transcripts.Transcript transcript, MediaSource mediaSource, string actionKey, string? question, string? conversationContext, string? transcriptExcerpt)
    {
        var transcriptContent = transcriptExcerpt ?? transcript.TranscriptText;

        return JsonSerializer.SerializeToElement(new
        {
            workflowId = workflow.Id,
            sourceId = workflow.SourceId,
            transcriptId = transcript.Id,
            actionKey,
            promptKey = prompt.PromptKey,
            video = new
            {
                title = TryGetMetadataString(mediaSource.Metadata, "title"),
                channel = TryGetMetadataString(mediaSource.Metadata, "channel"),
                language = transcript.Language,
                url = transcript.SourceUrl ?? mediaSource.CanonicalUrl
            },
            question,
            conversationContext,
            transcriptExcerpt,
            transcript = transcriptContent,
            systemPrompt = prompt.SystemPrompt,
            userPrompt = prompt.UserPrompt
        });
    }

    private static JsonElement BuildPromptRunRequestJson(Workflow workflow, Prompt prompt, Domain.Transcripts.Transcript transcript, MediaSource mediaSource, string actionKey, string? question, string? conversationContext, string? transcriptExcerpt, JsonElement stepInput)
    {
        var transcriptContent = transcriptExcerpt ?? transcript.TranscriptText;

        return JsonSerializer.SerializeToElement(new
        {
            workflowId = workflow.Id,
            promptId = prompt.Id,
            promptKey = prompt.PromptKey,
            actionKey,
            question,
            conversationContext,
            transcriptExcerpt,
            stepInput,
            video = new
            {
                title = TryGetMetadataString(mediaSource.Metadata, "title"),
                channel = TryGetMetadataString(mediaSource.Metadata, "channel"),
                language = transcript.Language
            },
            transcript = transcriptContent
        });
    }

    private static JsonElement BuildPromptRunResponseJson(ReasoningResponse reasoningResponse)
        => JsonSerializer.SerializeToElement(new
        {
            text = reasoningResponse.Text,
            raw = reasoningResponse.RawResponseJson,
            usage = reasoningResponse.Usage is null ? null : new
            {
                promptTokens = reasoningResponse.Usage.PromptTokens,
                completionTokens = reasoningResponse.Usage.CompletionTokens,
                totalTokens = reasoningResponse.Usage.TotalTokens
            }
        });

    private async Task RecordPromptRunAndFailAsync(Workflow workflow, WorkflowStep currentStep, Prompt prompt, Domain.Transcripts.Transcript transcript, MediaSource mediaSource, string actionKey, string? question, string? conversationContext, string? transcriptExcerpt, DateTimeOffset startedAt, ReasoningResponse reasoningResponse, string errorCode, string errorMessage, CancellationToken cancellationToken)
    {
        var failedAt = DateTimeOffset.UtcNow;
        await workflowsRepository.ExecuteInTransactionAsync(async (repository, transaction) =>
        {
            await promptsRepository.CreatePromptRunAsync(new PromptRun
            {
                Id = Guid.NewGuid(),
                PromptId = prompt.Id,
                WorkflowId = workflow.Id,
                StepKey = currentStep.StepKey,
                PromptKey = prompt.PromptKey,
                Title = prompt.Title,
                WorkflowType = prompt.WorkflowType,
                Provider = prompt.Provider,
                Model = reasoningResponse.Model,
                Request = BuildPromptRunRequestJson(workflow, prompt, transcript, mediaSource, actionKey, question, conversationContext, transcriptExcerpt, currentStep.Input),
                Response = BuildPromptRunResponseJson(reasoningResponse),
                Status = "failed",
                ErrorCode = errorCode,
                ErrorMessage = errorMessage,
                InputTokens = reasoningResponse.Usage?.PromptTokens,
                OutputTokens = reasoningResponse.Usage?.CompletionTokens,
                TotalTokens = reasoningResponse.Usage?.TotalTokens,
                DurationMs = null,
                StartedAt = startedAt,
                FinishedAt = failedAt,
                CreatedAt = failedAt,
                UpdatedAt = failedAt
            }, cancellationToken);

            await repository.UpdateWorkflowStepAsync(currentStep with
            {
                Status = "failed",
                ErrorCode = errorCode,
                ErrorMessage = errorMessage,
                FinishedAt = failedAt,
                UpdatedAt = failedAt
            }, transaction, cancellationToken);

            await repository.UpdateWorkflowAsync(workflow with
            {
                Status = "failed",
                ErrorCode = errorCode,
                ErrorMessage = errorMessage,
                CurrentStepKey = currentStep.StepKey,
                LockedBy = null,
                LockedAt = null,
                LockedUntil = null,
                FinishedAt = failedAt,
                UpdatedAt = failedAt
            }, transaction, cancellationToken);

            await repository.AddWorkflowEventAsync(workflow.Id, currentStep.StepKey, "error", errorMessage, JsonSerializer.SerializeToElement(new { errorCode }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);

        await ReleaseWorkflowBillingAsync(workflow with
        {
            Status = "failed",
            ErrorCode = errorCode,
            ErrorMessage = errorMessage,
            CurrentStepKey = currentStep.StepKey,
            FinishedAt = failedAt
        }, errorMessage, cancellationToken);
    }

    private static JsonElement ParseInsightResult(string value)
    {
        var json = ExtractJson(value);
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    private static string ExtractJson(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            trimmed = Regex.Replace(trimmed, "^```(?:json)?\\s*", string.Empty, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            trimmed = Regex.Replace(trimmed, "\\s*```$", string.Empty, RegexOptions.CultureInvariant);
        }

        var firstObject = trimmed.IndexOf('{');
        var lastObject = trimmed.LastIndexOf('}');
        if (firstObject >= 0 && lastObject > firstObject)
        {
            return trimmed[firstObject..(lastObject + 1)];
        }

        var firstArray = trimmed.IndexOf('[');
        var lastArray = trimmed.LastIndexOf(']');
        if (firstArray >= 0 && lastArray > firstArray)
        {
            return trimmed[firstArray..(lastArray + 1)];
        }

        return trimmed;
    }

    private static string? TryGetMetadataString(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    }

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();

    private static string RenderPrompt(string template, Domain.Transcripts.Transcript transcript, MediaSource mediaSource, string? question, string? conversationContext, string? transcriptExcerpt)
    {
        var replacements = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["video_title"] = TryGetMetadataString(mediaSource.Metadata, "title"),
            ["channel_name"] = TryGetMetadataString(mediaSource.Metadata, "channel"),
            ["language"] = transcript.Language,
            ["question"] = question,
            ["conversation_context"] = conversationContext,
            ["transcript_excerpt"] = transcriptExcerpt ?? transcript.TranscriptText,
            ["transcript"] = transcriptExcerpt ?? transcript.TranscriptText
        };

        var result = template;
        foreach (var (key, value) in replacements)
        {
            result = result.Replace($"{{{{{key}}}}}", JsonEncodedText.Encode(value ?? string.Empty, JavaScriptEncoder.UnsafeRelaxedJsonEscaping).ToString(), StringComparison.Ordinal);
        }

        return result;
    }

    private static string BuildTranscriptOverview(Domain.Transcripts.Transcript transcript, IReadOnlyList<TranscriptSegment> segments)
    {
        if (transcript.TranscriptText.Length <= InsightTranscriptMaxCharacters)
        {
            return transcript.TranscriptText;
        }

        if (segments.Count == 0)
        {
            return TruncateAtWordBoundary(transcript.TranscriptText, InsightTranscriptMaxCharacters);
        }

        var targetSegmentCount = Math.Min(90, segments.Count);
        var stride = Math.Max(1, (int)Math.Ceiling(segments.Count / (double)targetSegmentCount));
        var builder = new StringBuilder();
        builder.AppendLine("Transcript excerpt sampled across the full video because the original transcript is too long.");

        for (var index = 0; index < segments.Count; index += stride)
        {
            var segment = segments[index];
            var line = $"[{FormatTimestamp(segment.StartSeconds)}-{FormatTimestamp(segment.EndSeconds)}] {segment.Text.Trim()}";
            if (builder.Length + line.Length + Environment.NewLine.Length > InsightTranscriptMaxCharacters)
            {
                break;
            }

            builder.AppendLine(line);
        }

        var excerpt = builder.ToString().Trim();
        return excerpt.Length > 0 ? excerpt : TruncateAtWordBoundary(transcript.TranscriptText, InsightTranscriptMaxCharacters);
    }

    private static string BuildTranscriptExcerpt(Domain.Transcripts.Transcript transcript, IReadOnlyList<TranscriptSegment> segments, string? question, string? conversationContext)
    {
        if (segments.Count == 0)
        {
            return TruncateAtWordBoundary(transcript.TranscriptText, AskTranscriptMaxCharacters);
        }

        var contextParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(question))
        {
            contextParts.Add(question);
        }

        if (!string.IsNullOrWhiteSpace(conversationContext))
        {
            contextParts.Add(conversationContext);
        }

        var keywords = ExtractKeywords(string.Join(' ', contextParts));
        var selectedSegments = SelectRelevantSegments(segments, keywords);
        if (selectedSegments.Count == 0)
        {
            selectedSegments = segments.Take(Math.Min(6, segments.Count)).ToList();
        }

        var builder = new StringBuilder();
        foreach (var segment in selectedSegments)
        {
            var line = $"[{FormatTimestamp(segment.StartSeconds)}-{FormatTimestamp(segment.EndSeconds)}] {segment.Text.Trim()}";
            if (builder.Length > 0)
            {
                builder.AppendLine();
            }

            if (builder.Length + line.Length > AskTranscriptMaxCharacters)
            {
                break;
            }

            builder.Append(line);
        }

        var excerpt = builder.ToString().Trim();
        return excerpt.Length > 0 ? excerpt : TruncateAtWordBoundary(transcript.TranscriptText, AskTranscriptMaxCharacters);
    }

    private static string TruncateAtWordBoundary(string value, int maxCharacters)
    {
        if (value.Length <= maxCharacters)
        {
            return value;
        }

        var truncated = value[..maxCharacters];
        var lastWhitespace = truncated.LastIndexOfAny(new[] { ' ', '\n', '\r', '\t' });
        return (lastWhitespace > maxCharacters / 2 ? truncated[..lastWhitespace] : truncated).Trim();
    }

    private static List<TranscriptSegment> SelectRelevantSegments(IReadOnlyList<TranscriptSegment> segments, IReadOnlyCollection<string> keywords)
    {
        if (keywords.Count == 0)
        {
            return segments.Take(Math.Min(6, segments.Count)).ToList();
        }

        var scored = segments
            .Select((segment, index) => new
            {
                Segment = segment,
                Index = index,
                Score = ScoreSegment(segment.Text, keywords)
            })
            .Where(item => item.Score > 0)
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.Index)
            .Take(6)
            .ToList();

        var selected = new Dictionary<int, TranscriptSegment>();
        foreach (var item in scored)
        {
            AddNeighborhood(segments, selected, item.Index, 1);
        }

        return selected
            .OrderBy(item => item.Key)
            .Select(item => item.Value)
            .ToList();
    }

    private static void AddNeighborhood(IReadOnlyList<TranscriptSegment> segments, IDictionary<int, TranscriptSegment> selected, int centerIndex, int radius)
    {
        for (var index = Math.Max(0, centerIndex - radius); index <= Math.Min(segments.Count - 1, centerIndex + radius); index++)
        {
            if (!selected.ContainsKey(index))
            {
                selected[index] = segments[index];
            }
        }
    }

    private static int ScoreSegment(string text, IReadOnlyCollection<string> keywords)
    {
        var normalized = text.ToLowerInvariant();
        var score = 0;
        foreach (var keyword in keywords)
        {
            if (normalized.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                score++;
            }
        }

        return score;
    }

    private static HashSet<string> ExtractKeywords(string? text)
    {
        var keywords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(text))
        {
            return keywords;
        }

        foreach (var token in Regex.Split(text.ToLowerInvariant(), @"[^a-z0-9]+"))
        {
            if (token.Length < 4)
            {
                continue;
            }

            if (token is "this" or "that" or "with" or "from" or "what" or "when" or "where" or "which" or "about" or "video" or "context" or "answer")
            {
                continue;
            }

            keywords.Add(token);
            if (keywords.Count >= 12)
            {
                break;
            }
        }

        return keywords;
    }

    private static string FormatTimestamp(decimal seconds)
    {
        var duration = TimeSpan.FromSeconds((double)seconds);
        return duration.TotalHours >= 1
            ? duration.ToString(@"hh\:mm\:ss")
            : duration.ToString(@"mm\:ss");
    }

    private static string? ReadString(JsonElement element, string propertyName)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) ? property.GetString() : null;

    private static Guid? ReadGuid(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String)
        {
            return Guid.TryParse(property.GetString(), out var value) ? value : null;
        }

        return null;
    }

    private static bool ReadBool(JsonElement element, string propertyName, bool defaultValue)
    {
        if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property))
        {
            if (property.ValueKind == JsonValueKind.True)
            {
                return true;
            }

            if (property.ValueKind == JsonValueKind.False)
            {
                return false;
            }
        }

        return defaultValue;
    }

    private static string? GetString(JsonElement? element, string propertyName)
        => element is { ValueKind: JsonValueKind.Object } obj && obj.TryGetProperty(propertyName, out var property) ? property.GetString() : null;

    private static string GetWorkflowRootDirectory(string outputDirectory, Guid workflowId)
        => Path.Combine(outputDirectory, workflowId.ToString("N"));

    private static string GetStepOutputDirectory(string workflowRootDirectory, string stepName)
    {
        var stepDirectory = Path.Combine(workflowRootDirectory, stepName);
        Directory.CreateDirectory(stepDirectory);
        return stepDirectory;
    }

    private async Task UpdateMediaSourceNativeTranscriptAsync(MediaSource mediaSource, NativeTranscriptResult nativeResult, Guid workflowId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await mediaSourcesRepository.UpsertMediaSourceAsync(new MediaSource
        {
            Id = mediaSource.Id,
            SourceProvider = mediaSource.SourceProvider,
            SourceKind = mediaSource.SourceKind,
            ExternalSourceId = mediaSource.ExternalSourceId,
            CanonicalUrl = mediaSource.CanonicalUrl,
            OriginalUrl = mediaSource.OriginalUrl,
            DurationSeconds = nativeResult.DurationSeconds.HasValue ? (decimal?)Convert.ToDecimal(nativeResult.DurationSeconds.Value) : null,
            NativeTranscriptAvailable = nativeResult.Available,
            NativeTranscriptCheckedAt = now,
            NativeTranscriptLanguage = nativeResult.Language,
            Metadata = JsonSerializer.SerializeToElement(new
            {
                workflowId,
                nativeTranscript = nativeResult.Available
            }),
            CreatedAt = now,
            UpdatedAt = now
        }, null, cancellationToken);
    }

    private sealed record SubtitleSegment(double Start, double End, string Text);
    private sealed record NativeTranscriptResult(bool Available, string? TranscriptFilePath, string? Language, double? DurationSeconds)
    {
        public static NativeTranscriptResult NotAvailable() => new(false, null, null, null);
    }
    private sealed record ProcessResult(int ExitCode, IReadOnlyList<string> Output, IReadOnlyList<string> Errors);
}
