namespace AiSummarizer.Domain.Todos;

public sealed record TodoItem
{
    public Guid Id { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public Guid? ProjectId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public TodoCadence Cadence { get; init; } = TodoCadence.Daily;
    public TodoStatus Status { get; init; } = TodoStatus.Open;
    public TodoPriority Priority { get; init; } = TodoPriority.Medium;
    public DateTimeOffset? DueAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public int SortOrder { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
