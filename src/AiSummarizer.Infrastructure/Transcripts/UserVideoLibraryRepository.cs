using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Transcripts;

public sealed class UserVideoLibraryRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IUserVideoLibraryRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private UserVideoLibraryRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<IUserVideoLibraryRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new UserVideoLibraryRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

        try
        {
            var result = await action(scopedRepository, transaction);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    public Task<UserVideoLibraryItem> UpsertUserVideoAsync(UserVideoLibraryItem item, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Transcripts/UpsertUserVideoLibrary.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("id", item.Id);
            cmd.Parameters.AddWithValue("requested_by_user_id", item.RequestedByUserId);
            cmd.Parameters.AddWithValue("media_source_id", item.MediaSourceId);
            cmd.Parameters.AddWithValue("public_request_run_id", (object?)item.PublicRequestRunId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("workflow_id", (object?)item.WorkflowId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("transcript_id", (object?)item.TranscriptId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("status", item.Status);
            cmd.Parameters.AddWithValue("source_url", item.SourceUrl);
            cmd.Parameters.AddWithValue("completed_at", (object?)item.CompletedAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("created_at", item.CreatedAt.UtcDateTime);
            cmd.Parameters.AddWithValue("updated_at", item.UpdatedAt.UtcDateTime);
        }, transaction, cancellationToken, MapItem);

    public async Task<int> CompleteByMediaSourceIdAsync(Guid mediaSourceId, Guid transcriptId, DateTimeOffset completedAt, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        return await ExecuteNonQueryAsync("Transcripts/CompleteUserVideoLibraryByMediaSourceId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("media_source_id", mediaSourceId);
            cmd.Parameters.AddWithValue("transcript_id", transcriptId);
            cmd.Parameters.AddWithValue("completed_at", completedAt.UtcDateTime);
        }, transaction, cancellationToken);
    }

    public async Task<int> FailByMediaSourceIdAsync(Guid mediaSourceId, DateTimeOffset failedAt, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        return await ExecuteNonQueryAsync("Transcripts/FailUserVideoLibraryByMediaSourceId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("media_source_id", mediaSourceId);
            cmd.Parameters.AddWithValue("failed_at", failedAt.UtcDateTime);
        }, transaction, cancellationToken);
    }

    public Task<IReadOnlyList<UserVideoLibraryDto>> ListUserVideosAsync(Guid requestedByUserId, string? status, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Transcripts/ListUserVideoLibrary.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = requestedByUserId
            });
            cmd.Parameters.Add(new NpgsqlParameter("status", NpgsqlDbType.Text)
            {
                Value = (object?)status ?? DBNull.Value
            });
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapDto);

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new InvalidOperationException($"No rows returned for {sqlPath}.");
            }

            return mapper(reader);
        }

        var txConnection = transaction is NpgsqlTransaction npgsqlTransaction ? npgsqlTransaction.Connection : _connection;
        var tx = transaction as NpgsqlTransaction ?? _transaction;
        if (txConnection is null || tx is null)
        {
            throw new InvalidOperationException("Transaction is not associated with a connection.");
        }

        await using var txCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, tx);
        configure(txCommand);
        await using var txReader = await txCommand.ExecuteReaderAsync(cancellationToken);
        if (!await txReader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException($"No rows returned for {sqlPath}.");
        }

        return mapper(txReader);
    }

    private async Task<IReadOnlyList<T>> QueryManyAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
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

    private async Task<int> ExecuteNonQueryAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            return await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var txConnection = transaction is NpgsqlTransaction npgsqlTransaction ? npgsqlTransaction.Connection : _connection;
        var tx = transaction as NpgsqlTransaction ?? _transaction;
        if (txConnection is null || tx is null)
        {
            throw new InvalidOperationException("Transaction is not associated with a connection.");
        }

        await using var txCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, tx);
        configure(txCommand);
        return await txCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static UserVideoLibraryItem MapItem(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            MediaSourceId = reader.GetGuid(reader.GetOrdinal("media_source_id")),
            PublicRequestRunId = reader.IsDBNull(reader.GetOrdinal("public_request_run_id")) ? null : reader.GetGuid(reader.GetOrdinal("public_request_run_id")),
            WorkflowId = reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            TranscriptId = reader.IsDBNull(reader.GetOrdinal("transcript_id")) ? null : reader.GetGuid(reader.GetOrdinal("transcript_id")),
            Status = reader.GetString(reader.GetOrdinal("status")),
            SourceUrl = reader.GetString(reader.GetOrdinal("source_url")),
            CompletedAt = reader.IsDBNull(reader.GetOrdinal("completed_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("completed_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static UserVideoLibraryDto MapDto(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            reader.GetGuid(reader.GetOrdinal("media_source_id")),
            reader.IsDBNull(reader.GetOrdinal("public_request_run_id")) ? null : reader.GetGuid(reader.GetOrdinal("public_request_run_id")),
            reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            reader.IsDBNull(reader.GetOrdinal("transcript_id")) ? null : reader.GetGuid(reader.GetOrdinal("transcript_id")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetString(reader.GetOrdinal("source_provider")),
            reader.GetString(reader.GetOrdinal("source_kind")),
            reader.GetString(reader.GetOrdinal("external_source_id")),
            reader.GetString(reader.GetOrdinal("source_url")),
            reader.IsDBNull(reader.GetOrdinal("language")) ? null : reader.GetString(reader.GetOrdinal("language")),
            reader.IsDBNull(reader.GetOrdinal("duration_seconds")) ? null : reader.GetDecimal(reader.GetOrdinal("duration_seconds")),
            reader.IsDBNull(reader.GetOrdinal("completed_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("completed_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));
}
