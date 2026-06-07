using AiSummarizer.Application.Projects;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Todos;

namespace AiSummarizer.Application.Todos;

public sealed class TodosService(ITodosRepository repository, IUsersRepository usersRepository, IProjectsRepository projectsRepository) : ITodosService
{
    public async Task<TodoListDto> ListTodosAsync(Guid? requestedByUserId, Guid? projectId, string? cadence, string? status, int limit, int offset, CancellationToken cancellationToken)
    {
        var items = await repository.ListTodosAsync(requestedByUserId, projectId, cadence, status, limit, offset, cancellationToken);
        var stats = await repository.GetStatsAsync(requestedByUserId, projectId, cadence, status, cancellationToken);
        return new TodoListDto(items, stats);
    }

    public async Task<TodoItemDto> GetTodoAsync(Guid todoId, CancellationToken cancellationToken)
        => await repository.GetTodoByIdAsync(todoId, cancellationToken) ?? throw new TodoNotFoundException("Todo item not found.");

    public async Task<TodoItemDto> CreateTodoAsync(CreateTodoCommand command, CancellationToken cancellationToken)
    {
        var requestedByUserId = RequireRequestedByUserId(command.RequestedByUserId);
        await EnsureUserExistsAsync(requestedByUserId, cancellationToken);
        await EnsureProjectExistsAsync(command.ProjectId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var todoId = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var record = new TodoItemRecord(
                Guid.NewGuid(),
                requestedByUserId,
                command.ProjectId,
                NormalizeRequired(command.Title),
                NormalizeNullable(command.Description),
                NormalizeCadence(command.Cadence),
                NormalizeStatus(command.Status),
                NormalizePriority(command.Priority),
                command.DueAt,
                ParseStatus(command.Status) == TodoStatus.Done ? now : null,
                command.SortOrder ?? 0,
                now,
                now);

            return await txRepository.CreateTodoAsync(record, tx, cancellationToken);
        }, cancellationToken);

        return await GetTodoAsync(todoId, cancellationToken);
    }

    public async Task<TodoItemDto> UpdateTodoAsync(Guid todoId, UpdateTodoCommand command, CancellationToken cancellationToken)
    {
        var existing = await repository.GetTodoByIdAsync(todoId, cancellationToken)
            ?? throw new TodoNotFoundException("Todo item not found.");

        await EnsureProjectExistsAsync(command.ProjectId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var status = ParseStatus(command.Status);
        DateTimeOffset? completedAt = status == TodoStatus.Done ? existing.CompletedAt ?? now : null;

        var updatedId = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            return await txRepository.UpdateTodoAsync(new TodoItemRecord(
                existing.Id,
                existing.RequestedByUserId,
                command.ProjectId,
                NormalizeRequired(command.Title),
                NormalizeNullable(command.Description),
                NormalizeCadence(command.Cadence),
                NormalizeStatus(command.Status),
                NormalizePriority(command.Priority),
                command.DueAt,
                completedAt,
                command.SortOrder,
                existing.CreatedAt,
                now), tx, cancellationToken);
        }, cancellationToken);

        return await GetTodoAsync(updatedId, cancellationToken);
    }

    public async Task DeleteTodoAsync(Guid todoId, CancellationToken cancellationToken)
    {
        var existing = await repository.GetTodoByIdAsync(todoId, cancellationToken)
            ?? throw new TodoNotFoundException("Todo item not found.");

        await repository.DeleteTodoAsync(existing.Id, null, cancellationToken);
    }

    private async Task EnsureUserExistsAsync(Guid userId, CancellationToken cancellationToken)
    {
        _ = await usersRepository.GetUserByIdAsync(userId, null, cancellationToken)
            ?? throw new TodoValidationException("RequestedByUserId must reference an existing user.");
    }

    private async Task EnsureProjectExistsAsync(Guid? projectId, CancellationToken cancellationToken)
    {
        if (projectId is null) return;
        _ = await projectsRepository.GetProjectByIdAsync(projectId.Value, cancellationToken)
            ?? throw new TodoValidationException("ProjectId must reference an existing project.");
    }

    private static Guid RequireRequestedByUserId(Guid? requestedByUserId)
        => requestedByUserId ?? throw new TodoValidationException("RequestedByUserId is required.");

    private static string NormalizeRequired(string value)
        => string.IsNullOrWhiteSpace(value) ? throw new TodoValidationException("Title is required.") : value.Trim();

    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeCadence(string cadence) => ParseCadence(cadence).ToString().ToLowerInvariant();

    private static string NormalizeStatus(string status) => ParseStatus(status).ToString().ToLowerInvariant();

    private static string NormalizePriority(string priority) => ParsePriority(priority).ToString().ToLowerInvariant();

    private static TodoCadence ParseCadence(string cadence)
        => Enum.Parse<TodoCadence>(cadence.Trim(), true);

    private static TodoStatus ParseStatus(string status)
        => Enum.Parse<TodoStatus>(status.Trim(), true);

    private static TodoPriority ParsePriority(string priority)
        => Enum.Parse<TodoPriority>(priority.Trim(), true);
}
