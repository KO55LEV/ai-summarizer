namespace AiSummarizer.Domain.Projects;

public sealed record Project
{
    public Guid Id { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public IReadOnlyList<string> Aliases { get; init; } = Array.Empty<string>();
    public ProjectStatus Status { get; init; } = ProjectStatus.Active;
    public string? Color { get; init; }
    public string? Icon { get; init; }
    public bool IsDefault { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
