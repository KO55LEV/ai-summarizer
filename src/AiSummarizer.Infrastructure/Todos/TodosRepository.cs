using System.Data.Common;
using AiSummarizer.Application.Todos;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Todos;

public sealed class TodosRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : ITodosRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private TodosRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<ITodosRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new TodosRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

        try
        {
            var result = await action(scopedRepository, transaction);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public Task<TodoItemDto?> GetTodoByIdAsync(Guid todoId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Todos/GetTodoItemById.sql", cmd => cmd.Parameters.AddWithValue("todo_id", todoId), null, cancellationToken, MapTodo);

    public Task<IReadOnlyList<TodoItemDto>> ListTodosAsync(Guid? requestedByUserId, Guid? projectId, string? bucket, string? cadence, string? status, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Todos/ListTodoItems.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)requestedByUserId ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("project_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)projectId ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("bucket", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(bucket) ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("cadence", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(cadence) ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("status", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(status) ?? DBNull.Value
            });
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapTodo);

    public Task<TodoStatsDto> GetStatsAsync(Guid? requestedByUserId, Guid? projectId, string? bucket, string? cadence, string? status, CancellationToken cancellationToken)
        => QuerySingleAsync("Todos/GetTodoStats.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)requestedByUserId ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("project_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)projectId ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("bucket", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(bucket) ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("cadence", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(cadence) ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("status", NpgsqlDbType.Text)
            {
                Value = (object?)NormalizeNullable(status) ?? DBNull.Value
            });
        }, null, cancellationToken, reader => new TodoStatsDto(
            reader.GetInt32(reader.GetOrdinal("total_count")),
            reader.GetInt32(reader.GetOrdinal("open_count")),
            reader.GetInt32(reader.GetOrdinal("doing_count")),
            reader.GetInt32(reader.GetOrdinal("blocked_count")),
            reader.GetInt32(reader.GetOrdinal("done_count")),
            reader.GetInt32(reader.GetOrdinal("due_today_count")),
            reader.GetInt32(reader.GetOrdinal("overdue_count")),
            reader.GetInt32(reader.GetOrdinal("project_linked_count")),
            reader.GetInt32(reader.GetOrdinal("target_count"))));

    public Task<Guid> CreateTodoAsync(TodoItemRecord todo, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Todos/CreateTodoItem.sql", cmd =>
        {
            BindTodo(cmd, todo);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<Guid> UpdateTodoAsync(TodoItemRecord todo, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Todos/UpdateTodoItem.sql", cmd =>
        {
            BindTodo(cmd, todo);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task DeleteTodoAsync(Guid todoId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Todos/DeleteTodoItem.sql", cmd => cmd.Parameters.AddWithValue("todo_id", todoId), transaction, cancellationToken);

    private async Task<T?> QuerySingleOrDefaultAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? mapper(reader) : default;
        }

        await using var scopedCommand = CreateCommand(sqlPath, transaction);
        configure(scopedCommand);
        await using var scopedReader = await scopedCommand.ExecuteReaderAsync(cancellationToken);
        return await scopedReader.ReadAsync(cancellationToken) ? mapper(scopedReader) : default;
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        var result = await QuerySingleOrDefaultAsync(sqlPath, configure, transaction, cancellationToken, mapper);
        return result ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private async Task<IReadOnlyList<T>> QueryManyAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (_transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var items = new List<T>();
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(mapper(reader));
            }

            return items;
        }

        await using var scopedCommand = CreateCommand(sqlPath);
        configure(scopedCommand);
        await using var scopedReader = await scopedCommand.ExecuteReaderAsync(cancellationToken);
        var scopedItems = new List<T>();
        while (await scopedReader.ReadAsync(cancellationToken))
        {
            scopedItems.Add(mapper(scopedReader));
        }

        return scopedItems;
    }

    private async Task ExecuteNonQueryAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        await using var scopedCommand = CreateCommand(sqlPath, transaction);
        configure(scopedCommand);
        await scopedCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private NpgsqlCommand CreateCommand(string sqlPath, DbTransaction? transaction = null)
    {
        if (transaction is NpgsqlTransaction npgsqlTransaction)
        {
            return new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), npgsqlTransaction.Connection!, npgsqlTransaction);
        }

        if (_connection is not null && _transaction is not null)
        {
            return new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), _connection, _transaction);
        }

        throw new InvalidOperationException("A transaction-aware repository cannot execute without a transaction.");
    }

    private static void BindTodo(NpgsqlCommand command, TodoItemRecord todo)
    {
        command.Parameters.AddWithValue("id", todo.Id);
        command.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)todo.RequestedByUserId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("project_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)todo.ProjectId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("color", NpgsqlDbType.Text)
        {
            Value = (object?)todo.Color ?? DBNull.Value
        });
        command.Parameters.AddWithValue("bucket", todo.Bucket);
        command.Parameters.AddWithValue("title", todo.Title);
        command.Parameters.Add(new NpgsqlParameter("description", NpgsqlDbType.Text)
        {
            Value = (object?)todo.Description ?? DBNull.Value
        });
        command.Parameters.AddWithValue("cadence", todo.Cadence);
        command.Parameters.AddWithValue("status", todo.Status);
        command.Parameters.AddWithValue("priority", todo.Priority);
        command.Parameters.Add(new NpgsqlParameter("due_at", NpgsqlDbType.TimestampTz)
        {
            Value = (object?)todo.DueAt?.UtcDateTime ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("completed_at", NpgsqlDbType.TimestampTz)
        {
            Value = (object?)todo.CompletedAt?.UtcDateTime ?? DBNull.Value
        });
        command.Parameters.AddWithValue("sort_order", todo.SortOrder);
        command.Parameters.AddWithValue("created_at", todo.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", todo.UpdatedAt.UtcDateTime);
    }

    private static TodoItemDto MapTodo(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            reader.IsDBNull(reader.GetOrdinal("project_id")) ? null : reader.GetGuid(reader.GetOrdinal("project_id")),
            reader.IsDBNull(reader.GetOrdinal("project_name")) ? null : reader.GetString(reader.GetOrdinal("project_name")),
            reader.IsDBNull(reader.GetOrdinal("color")) ? null : reader.GetString(reader.GetOrdinal("color")),
            reader.GetString(reader.GetOrdinal("bucket")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            reader.GetString(reader.GetOrdinal("cadence")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetString(reader.GetOrdinal("priority")),
            reader.IsDBNull(reader.GetOrdinal("due_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("due_at")),
            reader.IsDBNull(reader.GetOrdinal("completed_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("completed_at")),
            reader.GetInt32(reader.GetOrdinal("sort_order")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
}
