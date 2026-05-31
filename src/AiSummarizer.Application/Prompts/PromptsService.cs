using AiSummarizer.Domain.Prompts;
using System.Text.Json;

namespace AiSummarizer.Application.Prompts;

public sealed class PromptsService(IPromptsRepository repository) : IPromptsService
{
    public async Task<PromptDto> CreatePromptAsync(CreatePromptCommand command, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var prompt = await repository.CreatePromptAsync(new Prompt
        {
            Id = Guid.NewGuid(),
            PromptKey = NormalizeKey(command.PromptKey),
            Title = command.Title.Trim(),
            Description = NormalizeNullable(command.Description),
            WorkflowType = NormalizeNullable(command.WorkflowType),
            Provider = NormalizeKey(command.Provider),
            Model = command.Model.Trim(),
            SystemPrompt = command.SystemPrompt.Trim(),
            UserPrompt = command.UserPrompt.Trim(),
            IsActive = command.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        }, cancellationToken);

        return Map(prompt);
    }

    public async Task<PromptDto> GetPromptAsync(Guid promptId, CancellationToken cancellationToken)
        => Map(await repository.GetPromptByIdAsync(promptId, cancellationToken) ?? throw new PromptNotFoundException("Prompt not found."));

    public async Task<IReadOnlyList<PromptDto>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListPromptsAsync(limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<PromptDto> UpdatePromptAsync(Guid promptId, UpdatePromptCommand command, CancellationToken cancellationToken)
    {
        var existing = await repository.GetPromptByIdAsync(promptId, cancellationToken)
            ?? throw new PromptNotFoundException("Prompt not found.");

        var prompt = existing with
        {
            PromptKey = NormalizeKey(command.PromptKey),
            Title = command.Title.Trim(),
            Description = NormalizeNullable(command.Description),
            WorkflowType = NormalizeNullable(command.WorkflowType),
            Provider = NormalizeKey(command.Provider),
            Model = command.Model.Trim(),
            SystemPrompt = command.SystemPrompt.Trim(),
            UserPrompt = command.UserPrompt.Trim(),
            IsActive = command.IsActive,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        return Map(await repository.UpdatePromptAsync(prompt, cancellationToken));
    }

    public async Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken)
        => await repository.DeletePromptAsync(promptId, cancellationToken);

    public async Task<IReadOnlyList<PromptArchiveDto>> ListPromptArchivesAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListPromptArchivesAsync(promptId, limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<IReadOnlyList<PromptRunDto>> ListPromptRunsAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken)
        => (await repository.ListPromptRunsAsync(promptId, limit, offset, cancellationToken)).Select(Map).ToArray();

    public async Task<PromptRunUsageDto> GetPromptRunUsageAsync(Guid promptId, CancellationToken cancellationToken)
        => Map(await repository.GetPromptRunUsageAsync(promptId, cancellationToken));

    public async Task<PromptRunDto> RecordPromptRunAsync(Guid promptId, CreatePromptRunCommand command, CancellationToken cancellationToken)
    {
        var prompt = await repository.GetPromptByIdAsync(promptId, cancellationToken)
            ?? throw new PromptNotFoundException("Prompt not found.");

        return Map(await repository.CreatePromptRunAsync(new PromptRun
        {
            Id = Guid.NewGuid(),
            PromptId = prompt.Id,
            WorkflowId = command.WorkflowId,
            StepKey = NormalizeNullable(command.StepKey),
            PromptKey = prompt.PromptKey,
            Title = prompt.Title,
            WorkflowType = prompt.WorkflowType,
            Provider = prompt.Provider,
            Model = prompt.Model,
            Request = command.Request,
            Response = command.Response,
            Status = NormalizeKey(command.Status),
            ErrorCode = NormalizeNullable(command.ErrorCode),
            ErrorMessage = NormalizeNullable(command.ErrorMessage),
            InputTokens = command.InputTokens,
            OutputTokens = command.OutputTokens,
            TotalTokens = command.TotalTokens,
            DurationMs = command.DurationMs,
            StartedAt = command.StartedAt,
            FinishedAt = command.FinishedAt,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }, cancellationToken));
    }

    private static PromptDto Map(Prompt prompt)
        => new(
            prompt.Id,
            prompt.PromptKey,
            prompt.Title,
            prompt.Description,
            prompt.WorkflowType,
            prompt.Provider,
            prompt.Model,
            prompt.SystemPrompt,
            prompt.UserPrompt,
            prompt.IsActive,
            prompt.CreatedAt,
            prompt.UpdatedAt);

    private static PromptArchiveDto Map(PromptArchive archive)
        => new(
            archive.Id,
            archive.PromptId,
            archive.ArchiveVersion,
            archive.ArchiveReason,
            archive.PromptKey,
            archive.Title,
            archive.Description,
            archive.WorkflowType,
            archive.Provider,
            archive.Model,
            archive.SystemPrompt,
            archive.UserPrompt,
            archive.IsActive,
            archive.ArchivedAt,
            archive.SourceUpdatedAt);

    private static PromptRunDto Map(PromptRun run)
        => new(
            run.Id,
            run.PromptId,
            run.WorkflowId,
            run.StepKey,
            run.PromptKey,
            run.Title,
            run.WorkflowType,
            run.Provider,
            run.Model,
            run.Request,
            run.Response,
            run.Status,
            run.ErrorCode,
            run.ErrorMessage,
            run.InputTokens,
            run.OutputTokens,
            run.TotalTokens,
            run.DurationMs,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt,
            run.UpdatedAt);

    private static PromptRunUsageDto Map(PromptRunUsage usage)
        => new(usage.PromptId, usage.TotalRuns, usage.SucceededRuns, usage.FailedRuns, usage.RunningRuns, usage.LastRunAt, usage.LastStatus);

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();
    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
