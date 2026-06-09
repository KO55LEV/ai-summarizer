namespace AiSummarizer.Application.Todos;

public sealed record TodoItemDto(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string? ProjectName,
    string Bucket,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    DateTimeOffset? CompletedAt,
    int SortOrder,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TodoItemRecord(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string Bucket,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    DateTimeOffset? CompletedAt,
    int SortOrder,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TodoStatsDto(
    int TotalCount,
    int OpenCount,
    int DoingCount,
    int BlockedCount,
    int DoneCount,
    int DueTodayCount,
    int OverdueCount,
    int ProjectLinkedCount,
    int TargetCount);

public sealed record TodoListDto(
    IReadOnlyList<TodoItemDto> Items,
    TodoStatsDto Stats);

public sealed record CreateTodoCommand(
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string? Bucket,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    int? SortOrder);

public sealed record UpdateTodoCommand(
    Guid? ProjectId,
    string? Bucket,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    int SortOrder);
