using AiSummarizer.Domain.Prompts;

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

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();
    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
