namespace AiSummarizer.Api.Todos;

public sealed record CreateTodoRequest(
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string? Bucket,
    string? Color,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    int? SortOrder);

public sealed record UpdateTodoRequest(
    Guid? ProjectId,
    string? Bucket,
    string? Color,
    string Title,
    string? Description,
    string Cadence,
    string Status,
    string Priority,
    DateTimeOffset? DueAt,
    int SortOrder);

public sealed record TodoStatsResponse(
    int TotalCount,
    int OpenCount,
    int DoingCount,
    int BlockedCount,
    int DoneCount,
    int DueTodayCount,
    int OverdueCount,
    int ProjectLinkedCount,
    int TargetCount);

public sealed record TodoResponse(
    Guid Id,
    Guid? RequestedByUserId,
    Guid? ProjectId,
    string? ProjectName,
    string? Color,
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

public sealed record TodoListResponse(
    IReadOnlyList<TodoResponse> Items,
    TodoStatsResponse Stats);
