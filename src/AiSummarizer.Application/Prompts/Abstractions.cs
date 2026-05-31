using AiSummarizer.Domain.Prompts;
using System.Text.Json;

namespace AiSummarizer.Application.Prompts;

public interface IPromptsRepository
{
    Task<Prompt> CreatePromptAsync(Prompt prompt, CancellationToken cancellationToken);
    Task<Prompt?> GetPromptByIdAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Prompt>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<Prompt> UpdatePromptAsync(Prompt prompt, CancellationToken cancellationToken);
    Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptArchive>> ListPromptArchivesAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptRun>> ListPromptRunsAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken);
    Task<PromptRun> CreatePromptRunAsync(PromptRun promptRun, CancellationToken cancellationToken);
    Task<PromptRunUsage> GetPromptRunUsageAsync(Guid promptId, CancellationToken cancellationToken);
}

public interface IPromptsService
{
    Task<PromptDto> CreatePromptAsync(CreatePromptCommand command, CancellationToken cancellationToken);
    Task<PromptDto> GetPromptAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptDto>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<PromptDto> UpdatePromptAsync(Guid promptId, UpdatePromptCommand command, CancellationToken cancellationToken);
    Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptArchiveDto>> ListPromptArchivesAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptRunDto>> ListPromptRunsAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken);
    Task<PromptRunUsageDto> GetPromptRunUsageAsync(Guid promptId, CancellationToken cancellationToken);
    Task<PromptRunDto> RecordPromptRunAsync(Guid promptId, CreatePromptRunCommand command, CancellationToken cancellationToken);
}
