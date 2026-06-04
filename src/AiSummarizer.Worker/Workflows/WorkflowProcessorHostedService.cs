using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Domain.Workflows;
using AiSummarizer.Worker.JobsProcessing.Handlers;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker.Workflows;

public sealed class WorkflowProcessorHostedService(
    IMediaSourcesRepository mediaSourcesRepository,
    IWorkflowsRepository workflowsRepository,
    IJobsRepository jobsRepository,
    IOptions<WorkflowOptions> options,
    IOptions<YouTubeDownloadOptions> youtubeDownloadOptions,
    IOptions<WhisperTranscribeOptions> whisperTranscribeOptions,
    ILogger<WorkflowProcessorHostedService> logger) : BackgroundService
{
    private static readonly Regex VttTimestampRegex = new(@"^(?<start>\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(?<end>\d{2}:\d{2}:\d{2}\.\d{3})", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly HashSet<string> SupportedWorkflowTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "youtube.summary",
        "youtube.transcript"
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

        var currentStep = await GetLatestStepAsync(workflow.Id, cancellationToken);
        if (currentStep is null)
        {
            await StartWorkflowAsync(workflow, mediaSource, sourceIdentity, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, cancellationToken);
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
                await HandleSucceededStepAsync(workflow, currentStep, job, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
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

        await StartWorkflowAsync(workflow, mediaSource, sourceIdentity, sourceUrl, preferredLanguage, preferNativeTranscript, workflowRootDirectory, cancellationToken);
    }

    private async Task StartWorkflowAsync(Workflow workflow, MediaSource mediaSource, MediaSourceIdentity sourceIdentity, string sourceUrl, string? preferredLanguage, bool preferNativeTranscript, string workflowRootDirectory, CancellationToken cancellationToken)
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

    private async Task HandleSucceededStepAsync(Workflow workflow, WorkflowStep currentStep, Job job, string sourceUrl, string? preferredLanguage, bool preferNativeTranscript, string workflowRootDirectory, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
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
                await CreateTranscribeJobAsync(workflow, completedStep, GetString(job.Result, "outputFilePath"), sourceUrl, preferredLanguage, workflowRootDirectory, workerId, leaseDuration, cancellationToken);
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

    private async Task CreateTranscribeJobAsync(Workflow workflow, WorkflowStep previousStep, string? audioFilePath, string sourceUrl, string? preferredLanguage, string workflowRootDirectory, string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
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
        var job = await jobsRepository.CreateJobAsync(new Job
        {
            Id = Guid.NewGuid(),
            RequestedByUserId = workflow.RequestedByUserId,
            ParentJobId = null,
            JobType = "whisper.transcribe",
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
            await repository.AddWorkflowEventAsync(workflow.Id, step.StepKey, "info", "Queued Whisper transcription job.", JsonSerializer.SerializeToElement(new { jobId = job.Id, audioFilePath, sourceUrl }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

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
    }

    private async Task FailWorkflowAsync(Workflow workflow, string errorCode, string errorMessage, CancellationToken cancellationToken)
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
            await repository.UpdateWorkflowAsync(workflow, transaction, cancellationToken);
            await repository.AddWorkflowEventAsync(workflow.Id, workflow.CurrentStepKey, "error", errorMessage, JsonSerializer.SerializeToElement(new { errorCode }), transaction, cancellationToken);
            return 0;
        }, cancellationToken);
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
