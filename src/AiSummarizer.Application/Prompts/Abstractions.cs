using AiSummarizer.Domain.Prompts;

namespace AiSummarizer.Application.Prompts;

public interface IPromptsRepository
{
    Task<Prompt> CreatePromptAsync(Prompt prompt, CancellationToken cancellationToken);
    Task<Prompt?> GetPromptByIdAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Prompt>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<Prompt> UpdatePromptAsync(Prompt prompt, CancellationToken cancellationToken);
    Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken);
}

public interface IPromptsService
{
    Task<PromptDto> CreatePromptAsync(CreatePromptCommand command, CancellationToken cancellationToken);
    Task<PromptDto> GetPromptAsync(Guid promptId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PromptDto>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken);
    Task<PromptDto> UpdatePromptAsync(Guid promptId, UpdatePromptCommand command, CancellationToken cancellationToken);
    Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken);
}
