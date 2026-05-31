using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.PublicRequests;
using AiSummarizer.Domain.PublicRequests;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.PublicRequests;

public sealed class PublicRequestRunsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IPublicRequestRunsRepository
{
    public async Task<T> ExecuteInTransactionAsync<T>(Func<IPublicRequestRunsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var result = await action(this, transaction);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    public Task<PublicRequestRun> CreatePublicRequestRunAsync(PublicRequestRun requestRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("PublicRequestRuns/CreatePublicRequestRun.sql", cmd =>
        {
            Bind(requestRun, cmd, includeRequest: true, includeResponse: false);
        }, transaction, cancellationToken, Map);

    public Task<PublicRequestRun> UpdatePublicRequestRunAsync(PublicRequestRun requestRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("PublicRequestRuns/UpdatePublicRequestRun.sql", cmd =>
        {
            Bind(requestRun, cmd, includeRequest: true, includeResponse: true);
        }, transaction, cancellationToken, Map);

    public Task<PublicRequestRun?> GetPublicRequestRunByIdAsync(Guid requestRunId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("PublicRequestRuns/GetPublicRequestRunById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("request_run_id", requestRunId);
        }, cancellationToken);

    public Task<IReadOnlyList<PublicRequestRun>> ListPublicRequestRunsAsync(Guid? requestedByUserId, string? operationName, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("PublicRequestRuns/ListPublicRequestRuns.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("requested_by_user_id", (object?)requestedByUserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("operation_name", (object?)operationName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    private static void Bind(PublicRequestRun requestRun, NpgsqlCommand command, bool includeRequest, bool includeResponse)
    {
        command.Parameters.AddWithValue("id", requestRun.Id);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)requestRun.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("api_area", requestRun.ApiArea);
        command.Parameters.AddWithValue("operation_name", requestRun.OperationName);
        command.Parameters.AddWithValue("http_method", requestRun.HttpMethod);
        command.Parameters.AddWithValue("request_path", requestRun.RequestPath);
        command.Parameters.AddWithValue("source_id", (object?)requestRun.SourceId ?? DBNull.Value);
        command.Parameters.AddWithValue("source_provider", (object?)requestRun.SourceProvider ?? DBNull.Value);
        command.Parameters.AddWithValue("source_kind", (object?)requestRun.SourceKind ?? DBNull.Value);
        command.Parameters.AddWithValue("external_source_id", (object?)requestRun.ExternalSourceId ?? DBNull.Value);
        command.Parameters.AddWithValue("source_url", (object?)requestRun.SourceUrl ?? DBNull.Value);
        command.Parameters.AddWithValue("workflow_id", (object?)requestRun.WorkflowId ?? DBNull.Value);
        command.Parameters.AddWithValue("transcript_id", (object?)requestRun.TranscriptId ?? DBNull.Value);

        if (includeRequest)
        {
            command.Parameters.Add(new NpgsqlParameter("request_json", NpgsqlDbType.Jsonb)
            {
                Value = requestRun.Request.ValueKind == JsonValueKind.Undefined ? "{}" : requestRun.Request.GetRawText()
            });
        }

        if (includeResponse)
        {
            command.Parameters.Add(new NpgsqlParameter("response_json", NpgsqlDbType.Jsonb)
            {
                Value = requestRun.Response is null ? DBNull.Value : requestRun.Response.Value.GetRawText()
            });
        }

        command.Parameters.AddWithValue("status", requestRun.Status);
        command.Parameters.AddWithValue("error_code", (object?)requestRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)requestRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", requestRun.StartedAt.UtcDateTime);
        command.Parameters.AddWithValue("finished_at", (object?)requestRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", requestRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", requestRun.UpdatedAt.UtcDateTime);
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null)
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

        var txConnection = (NpgsqlConnection)transaction.Connection ?? throw new InvalidOperationException("Transaction is not associated with a connection.");
        await using (var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, (NpgsqlTransaction)transaction))
        {
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new InvalidOperationException($"No rows returned for {sqlPath}.");
            }

            return mapper(reader);
        }
    }

    private async Task<PublicRequestRun?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? Map(reader) : null;
    }

    private async Task<IReadOnlyList<PublicRequestRun>> QueryManyAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<PublicRequestRun>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(Map(reader));
        }

        return items;
    }

    private static PublicRequestRun Map(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            ApiArea = reader.GetString(reader.GetOrdinal("api_area")),
            OperationName = reader.GetString(reader.GetOrdinal("operation_name")),
            HttpMethod = reader.GetString(reader.GetOrdinal("http_method")),
            RequestPath = reader.GetString(reader.GetOrdinal("request_path")),
            SourceId = reader.IsDBNull(reader.GetOrdinal("source_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_id")),
            SourceProvider = reader.IsDBNull(reader.GetOrdinal("source_provider")) ? null : reader.GetString(reader.GetOrdinal("source_provider")),
            SourceKind = reader.IsDBNull(reader.GetOrdinal("source_kind")) ? null : reader.GetString(reader.GetOrdinal("source_kind")),
            ExternalSourceId = reader.IsDBNull(reader.GetOrdinal("external_source_id")) ? null : reader.GetString(reader.GetOrdinal("external_source_id")),
            SourceUrl = reader.IsDBNull(reader.GetOrdinal("source_url")) ? null : reader.GetString(reader.GetOrdinal("source_url")),
            WorkflowId = reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            TranscriptId = reader.IsDBNull(reader.GetOrdinal("transcript_id")) ? null : reader.GetGuid(reader.GetOrdinal("transcript_id")),
            Request = JsonDocument.Parse(reader.GetString(reader.GetOrdinal("request_json"))).RootElement.Clone(),
            Response = reader.IsDBNull(reader.GetOrdinal("response_json")) ? null : JsonDocument.Parse(reader.GetString(reader.GetOrdinal("response_json"))).RootElement.Clone(),
            Status = reader.GetString(reader.GetOrdinal("status")),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            StartedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };
}
