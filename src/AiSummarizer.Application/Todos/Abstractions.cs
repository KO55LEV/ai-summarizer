using System.Data.Common;
using AiSummarizer.Domain.Todos;

namespace AiSummarizer.Application.Todos;

public interface ITodosRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<ITodosRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<TodoItemDto?> GetTodoByIdAsync(Guid todoId, CancellationToken cancellationToken);
    Task<IReadOnlyList<TodoItemDto>> ListTodosAsync(Guid? requestedByUserId, Guid? projectId, string? cadence, string? status, int limit, int offset, CancellationToken cancellationToken);
    Task<TodoStatsDto> GetStatsAsync(Guid? requestedByUserId, Guid? projectId, string? cadence, string? status, CancellationToken cancellationToken);
    Task<Guid> CreateTodoAsync(TodoItemRecord todo, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Guid> UpdateTodoAsync(TodoItemRecord todo, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteTodoAsync(Guid todoId, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface ITodosService
{
    Task<TodoListDto> ListTodosAsync(Guid? requestedByUserId, Guid? projectId, string? cadence, string? status, int limit, int offset, CancellationToken cancellationToken);
    Task<TodoItemDto> GetTodoAsync(Guid todoId, CancellationToken cancellationToken);
    Task<TodoItemDto> CreateTodoAsync(CreateTodoCommand command, CancellationToken cancellationToken);
    Task<TodoItemDto> UpdateTodoAsync(Guid todoId, UpdateTodoCommand command, CancellationToken cancellationToken);
    Task DeleteTodoAsync(Guid todoId, CancellationToken cancellationToken);
}
