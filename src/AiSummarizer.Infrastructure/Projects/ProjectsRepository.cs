using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Projects;
using AiSummarizer.Domain.Projects;
using AiSummarizer.Infrastructure.Persistence;
using NpgsqlTypes;
using Npgsql;

namespace AiSummarizer.Infrastructure.Projects;

public sealed class ProjectsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IProjectsRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private ProjectsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<IProjectsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new ProjectsRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

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

    public Task<Project?> GetProjectByIdAsync(Guid projectId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Projects/GetProjectById.sql", cmd => cmd.Parameters.AddWithValue("project_id", projectId), null, cancellationToken, MapProject);

    public Task<IReadOnlyList<Project>> ListProjectsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Projects/ListProjects.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("requested_by_user_id", (object?)requestedByUserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, null, cancellationToken, MapProject);

    public Task<Project?> GetDefaultProjectAsync(Guid? requestedByUserId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Projects/GetDefaultProject.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("requested_by_user_id", (object?)requestedByUserId ?? DBNull.Value);
        }, null, cancellationToken, MapProject);

    public Task<Project> CreateProjectAsync(Project project, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Projects/CreateProject.sql", cmd =>
        {
            BindProject(cmd, project);
        }, transaction, cancellationToken, MapProject);

    public Task<Project> UpdateProjectAsync(Project project, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Projects/UpdateProject.sql", cmd =>
        {
            BindProject(cmd, project);
        }, transaction, cancellationToken, MapProject);

    public Task DeleteProjectAsync(Guid projectId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Projects/DeleteProject.sql", cmd => cmd.Parameters.AddWithValue("project_id", projectId), transaction, cancellationToken);

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

    private async Task<IReadOnlyList<T>> QueryManyAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null && _transaction is null)
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

        await using var scopedCommand = CreateCommand(sqlPath, transaction);
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
        if (transaction is null)
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
        var sql = sqlScriptLoader.Load(sqlPath);
        if (transaction is not null)
        {
            var npgsqlTransaction = (NpgsqlTransaction)transaction;
            return new NpgsqlCommand(sql, npgsqlTransaction.Connection!, npgsqlTransaction);
        }

        if (_connection is not null && _transaction is not null)
        {
            return new NpgsqlCommand(sql, _connection, _transaction);
        }

        throw new InvalidOperationException("A transaction-aware repository cannot execute without a transaction.");
    }

    private static void BindProject(NpgsqlCommand command, Project project)
    {
        command.Parameters.AddWithValue("id", project.Id);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)project.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("name", project.Name);
        command.Parameters.AddWithValue("description", (object?)project.Description ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("aliases_json", NpgsqlDbType.Jsonb)
        {
            Value = JsonSerializer.Serialize(project.Aliases ?? Array.Empty<string>())
        });
        command.Parameters.AddWithValue("status", project.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("color", (object?)project.Color ?? DBNull.Value);
        command.Parameters.AddWithValue("icon", (object?)project.Icon ?? DBNull.Value);
        command.Parameters.AddWithValue("is_default", project.IsDefault);
        command.Parameters.AddWithValue("created_at", project.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", project.UpdatedAt.UtcDateTime);
    }

    private static Project MapProject(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            Name = reader.GetString(reader.GetOrdinal("name")),
            Description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            Aliases = ParseAliases(reader.GetString(reader.GetOrdinal("aliases_json"))),
            Status = Enum.Parse<ProjectStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            Color = reader.IsDBNull(reader.GetOrdinal("color")) ? null : reader.GetString(reader.GetOrdinal("color")),
            Icon = reader.IsDBNull(reader.GetOrdinal("icon")) ? null : reader.GetString(reader.GetOrdinal("icon")),
            IsDefault = reader.GetBoolean(reader.GetOrdinal("is_default")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static IReadOnlyList<string> ParseAliases(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }

        var aliases = new List<string>();
        foreach (var element in document.RootElement.EnumerateArray())
        {
            var alias = element.GetString();
            if (!string.IsNullOrWhiteSpace(alias))
            {
                aliases.Add(alias.Trim());
            }
        }

        return aliases;
    }
}
