using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Api.Research;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Worker;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiSummarizer.Tests.Research;

public sealed class ResearchMvpHardeningTests
{
    [Fact]
    public async Task Manual_run_enqueues_when_no_active_run_exists()
    {
        var topic = BuildTopic(status: "active");
        var researchService = new FakeResearchService(topic);
        var repository = new FakeResearchRepository { ActiveRun = null };
        var jobs = new FakeJobsService();
        var controller = new ResearchController(researchService);

        var result = await controller.StartRun(topic.Id, new StartResearchTopicRunRequest(topic.RequestedByUserId, "manual", true), jobs, repository, CancellationToken.None);

        var response = Assert.IsType<OkObjectResult>(result.Result).Value as StartResearchTopicRunResponse;
        Assert.NotNull(response);
        Assert.Equal("queued", response!.Status);
        Assert.NotNull(response.JobId);
        Assert.Null(response.ExistingRunId);
        Assert.Single(jobs.Created);
    }

    [Fact]
    public async Task Manual_run_does_not_enqueue_duplicate_when_active_run_exists()
    {
        var topic = BuildTopic(status: "active");
        var activeRun = new ResearchActiveTopicRunDto(Guid.NewGuid(), Guid.NewGuid(), "queued", DateTimeOffset.UtcNow);
        var researchService = new FakeResearchService(topic);
        var repository = new FakeResearchRepository { ActiveRun = activeRun };
        var jobs = new FakeJobsService();
        var controller = new ResearchController(researchService);

        var result = await controller.StartRun(topic.Id, new StartResearchTopicRunRequest(topic.RequestedByUserId, "manual", true), jobs, repository, CancellationToken.None);

        var response = Assert.IsType<OkObjectResult>(result.Result).Value as StartResearchTopicRunResponse;
        Assert.NotNull(response);
        Assert.Equal("already_running", response!.Status);
        Assert.Equal(activeRun.Id, response.ExistingRunId);
        Assert.Empty(jobs.Created);
    }

    [Fact]
    public async Task Scheduler_enqueues_due_active_topic_and_advances_next_run()
    {
        var topic = BuildTopic(status: "active", nextRunAt: DateTimeOffset.UtcNow.AddMinutes(-1));
        var repository = new FakeResearchRepository { DueTopics = [topic] };
        var jobs = new FakeJobsRepository();
        var scheduler = CreateScheduler(repository, jobs);

        await scheduler.RunOnceAsync(CancellationToken.None);

        Assert.Single(jobs.Created);
        Assert.Equal("research.topic.run", jobs.Created.Single().JobType);
        Assert.Equal(topic.Id.ToString(), jobs.Created.Single().Payload.GetProperty("researchTopicId").GetString());
        Assert.NotNull(repository.UpdatedNextRunAt);
        Assert.True(repository.UpdatedNextRunAt > DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task Scheduler_skips_topic_with_active_run()
    {
        var topic = BuildTopic(status: "active", nextRunAt: DateTimeOffset.UtcNow.AddMinutes(-1));
        var repository = new FakeResearchRepository
        {
            DueTopics = [topic],
            ActiveRun = new ResearchActiveTopicRunDto(Guid.NewGuid(), Guid.NewGuid(), "running", DateTimeOffset.UtcNow)
        };
        var jobs = new FakeJobsRepository();
        var scheduler = CreateScheduler(repository, jobs);

        await scheduler.RunOnceAsync(CancellationToken.None);

        Assert.Empty(jobs.Created);
        Assert.Null(repository.UpdatedNextRunAt);
    }

    private static ResearchTopicSchedulerHostedService CreateScheduler(FakeResearchRepository repository, FakeJobsRepository jobs)
        => new(
            repository,
            jobs,
            Options.Create(new ResearchSchedulerOptions { Enabled = true, PollIntervalSeconds = 60, BatchSize = 10 }),
            NullLogger<ResearchTopicSchedulerHostedService>.Instance);

    private static ResearchTopicDto BuildTopic(string status, DateTimeOffset? nextRunAt = null)
        => new(
            Guid.NewGuid(),
            Guid.NewGuid(),
            null,
            "AI Weekly News",
            "Track AI news.",
            "daily",
            status,
            new TimeOnly(8, 0),
            ["web", "news"],
            ["ai"],
            ["briefing", "structured"],
            0,
            null,
            nextRunAt,
            null,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow);

    private sealed class FakeResearchService(ResearchTopicDto topic) : IResearchService
    {
        public Task<ResearchListDto> GetResearchListAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchTopicDto> GetTopicAsync(Guid topicId, CancellationToken cancellationToken) => Task.FromResult(topic);
        public Task<ResearchTopicDto> CreateTopicAsync(CreateResearchTopicCommand command, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchTopicDto> UpdateTopicAsync(Guid topicId, UpdateResearchTopicCommand command, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchBriefingDto> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchBriefingDto> GetBriefingAsync(Guid topicId, Guid briefingId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchBriefingDto> CreateBriefingAsync(Guid topicId, CreateResearchBriefingCommand command, CancellationToken cancellationToken) => throw new NotImplementedException();
    }

    private sealed class FakeJobsService : IJobsService
    {
        public List<CreateJobCommand> Created { get; } = [];

        public Task<CreateJobResult> CreateJobAsync(CreateJobCommand command, CancellationToken cancellationToken)
        {
            Created.Add(command);
            var now = DateTimeOffset.UtcNow;
            return Task.FromResult(new CreateJobResult(new JobDto(
                Guid.NewGuid(),
                command.ParentJobId,
                command.RequestedByUserId,
                command.JobType,
                command.Priority,
                "queued",
                command.Payload,
                null,
                null,
                null,
                null,
                0,
                command.MaxAttempts,
                now,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                now,
                now)));
        }

        public Task<JobDto> GetJobAsync(Guid jobId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<JobDto>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<JobDto>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<JobLogDto>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
    }

    private sealed class FakeJobsRepository : IJobsRepository
    {
        public List<Job> Created { get; } = [];

        public Task<Job> CreateJobAsync(Job job, CancellationToken cancellationToken)
        {
            var created = job with { Id = job.Id == Guid.Empty ? Guid.NewGuid() : job.Id };
            Created.Add(created);
            return Task.FromResult(created);
        }

        public Task<Job?> GetJobByIdAsync(Guid jobId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<Job>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<Job>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<JobLog>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Job?> ClaimNextJobAsync(string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> HeartbeatJobAsync(Guid jobId, string workerId, short? progressPercent, string? progressMessage, TimeSpan leaseDuration, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> CompleteJobAsync(Guid jobId, string workerId, JsonElement? result, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> FailJobAsync(Guid jobId, string workerId, string errorCode, string errorMessage, JsonElement? errorDetails, bool deadLetter, TimeSpan retryDelay, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> CancelJobAsync(Guid jobId, string workerId, string reason, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> RequestCancelAsync(Guid jobId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<JobLog> AddLogAsync(Guid jobId, int? attemptNo, string level, string message, JsonElement? context, CancellationToken cancellationToken) => throw new NotImplementedException();
    }

    private sealed class FakeResearchRepository : IResearchRepository
    {
        public IReadOnlyList<ResearchTopicDto> DueTopics { get; init; } = [];
        public ResearchActiveTopicRunDto? ActiveRun { get; init; }
        public DateTimeOffset? UpdatedNextRunAt { get; private set; }

        public Task<IReadOnlyList<ResearchTopicDto>> ListDueActiveTopicsAsync(DateTimeOffset dueAt, int limit, CancellationToken cancellationToken)
            => Task.FromResult(DueTopics.Where(topic => topic.Status == "active" && topic.NextRunAt <= dueAt).Take(limit).ToArray() as IReadOnlyList<ResearchTopicDto>);

        public Task<bool> HasActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken) => Task.FromResult(ActiveRun is not null);
        public Task<ResearchActiveTopicRunDto?> GetActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken) => Task.FromResult(ActiveRun);
        public Task UpdateTopicNextRunAtAsync(Guid topicId, DateTimeOffset? nextRunAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            UpdatedNextRunAt = nextRunAt;
            return Task.CompletedTask;
        }

        public Task<T> ExecuteInTransactionAsync<T>(Func<IResearchRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchTopicDto?> GetTopicByIdAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchTopicDto>> ListTopicsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchStatsDto> GetStatsAsync(Guid? requestedByUserId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> UpdateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task DeleteTopicAsync(Guid topicId, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task ReplaceTopicSourcesAsync(Guid topicId, IReadOnlyList<string> sources, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task ReplaceTopicTagsAsync(Guid topicId, IReadOnlyList<string> tags, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task ReplaceTopicOutputsAsync(Guid topicId, IReadOnlyList<string> outputs, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<int> GetBriefingCountAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchBriefingDto?> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchBriefingDto?> GetBriefingByIdAsync(Guid briefingId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateBriefingAsync(ResearchBriefingRecord briefing, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task ReplaceBriefingSectionsAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSectionInput> sections, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task ReplaceBriefingSourcesAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSourceInput> sources, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateTopicBriefingStateAsync(Guid topicId, DateTimeOffset? lastRunAt, DateTimeOffset? nextRunAt, string? lastBriefingPreview, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchTopicRunDto?> GetTopicRunByIdAsync(Guid runId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchTopicRunDto>> ListTopicRunsAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchTopicRunDto>> ListActiveTopicRunJobsAsync(Guid topicId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchTopicRunPhaseDto?> GetTopicRunPhaseAsync(Guid runId, string phaseKey, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchTopicRunPhaseDto>> ListTopicRunPhasesAsync(Guid runId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateSearchResultAsync(ResearchSearchResultRecord result, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchSearchResultDto>> ListSearchResultsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchContentRunDto?> GetContentRunByIdAsync(Guid contentRunId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchContentItemDto>> ListContentItemsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateDocumentAsync(ResearchDocumentRecord document, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateDocumentChunkAsync(ResearchDocumentChunkRecord chunk, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchDocumentDto>> ListDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchDocumentChunkDto>> ListDocumentChunksAsync(Guid researchDocumentId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchRankingRunDto?> GetRankingRunByIdAsync(Guid rankingRunId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchRankingRunDto>> ListRankingRunsAsync(Guid researchTopicRunId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateRankedDocumentAsync(ResearchRankedDocumentRecord rankedDocument, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchRankedDocumentDto>> ListRankedDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<Guid> CreateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<ResearchSynthesisRunDto?> GetSynthesisRunByIdAsync(Guid synthesisRunId, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<ResearchSynthesisRunDto>> ListSynthesisRunsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken) => throw new NotImplementedException();
    }
}
