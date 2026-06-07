using AiSummarizer.Application.Todos;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Todos;

[ApiController]
[Route("api/todos")]
public sealed class TodosController(ITodosService todosService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TodoListResponse>> GetList(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? cadence = null,
        [FromQuery] string? status = null,
        [FromQuery] int limit = 100,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => Ok(Map(await todosService.ListTodosAsync(requestedByUserId, projectId, cadence, status, limit, offset, cancellationToken)));

    [HttpGet("{todoId:guid}")]
    public async Task<ActionResult<TodoResponse>> GetTodo([FromRoute] Guid todoId, CancellationToken cancellationToken)
        => Ok(Map(await todosService.GetTodoAsync(todoId, cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<TodoResponse>> CreateTodo([FromBody] CreateTodoRequest request, CancellationToken cancellationToken)
        => Ok(Map(await todosService.CreateTodoAsync(new CreateTodoCommand(
            request.RequestedByUserId,
            request.ProjectId,
            request.Title,
            request.Description,
            request.Cadence,
            request.Status,
            request.Priority,
            request.DueAt,
            request.SortOrder), cancellationToken)));

    [HttpPut("{todoId:guid}")]
    public async Task<ActionResult<TodoResponse>> UpdateTodo([FromRoute] Guid todoId, [FromBody] UpdateTodoRequest request, CancellationToken cancellationToken)
        => Ok(Map(await todosService.UpdateTodoAsync(todoId, new UpdateTodoCommand(
            request.ProjectId,
            request.Title,
            request.Description,
            request.Cadence,
            request.Status,
            request.Priority,
            request.DueAt,
            request.SortOrder), cancellationToken)));

    [HttpDelete("{todoId:guid}")]
    public async Task<IActionResult> DeleteTodo([FromRoute] Guid todoId, CancellationToken cancellationToken)
    {
        await todosService.DeleteTodoAsync(todoId, cancellationToken);
        return NoContent();
    }

    private static TodoListResponse Map(TodoListDto list)
        => new(list.Items.Select(Map).ToArray(), Map(list.Stats));

    private static TodoResponse Map(TodoItemDto todo)
        => new(
            todo.Id,
            todo.RequestedByUserId,
            todo.ProjectId,
            todo.ProjectName,
            todo.Title,
            todo.Description,
            todo.Cadence,
            todo.Status,
            todo.Priority,
            todo.DueAt,
            todo.CompletedAt,
            todo.SortOrder,
            todo.CreatedAt,
            todo.UpdatedAt);

    private static TodoStatsResponse Map(TodoStatsDto stats)
        => new(
            stats.TotalCount,
            stats.OpenCount,
            stats.DoingCount,
            stats.BlockedCount,
            stats.DoneCount,
            stats.DueTodayCount,
            stats.OverdueCount,
            stats.ProjectLinkedCount,
            stats.TargetCount);
}
