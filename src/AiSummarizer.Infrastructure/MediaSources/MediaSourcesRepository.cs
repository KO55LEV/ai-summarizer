using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.MediaSources;
using AiSummarizer.Domain.MediaSources;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.MediaSources;

public sealed class MediaSourcesRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IMediaSourcesRepository
{
    public async Task<T> ExecuteInTransactionAsync<T>(Func<IMediaSourcesRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
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

    public Task<MediaSource> UpsertMediaSourceAsync(MediaSource mediaSource, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("MediaSources/UpsertMediaSource.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("id", mediaSource.Id);
            cmd.Parameters.AddWithValue("source_provider", mediaSource.SourceProvider);
            cmd.Parameters.AddWithValue("source_kind", mediaSource.SourceKind);
            cmd.Parameters.AddWithValue("external_source_id", mediaSource.ExternalSourceId);
            cmd.Parameters.AddWithValue("canonical_url", mediaSource.CanonicalUrl);
            cmd.Parameters.AddWithValue("original_url", mediaSource.OriginalUrl);
            cmd.Parameters.AddWithValue("duration_seconds", (object?)mediaSource.DurationSeconds ?? DBNull.Value);
            cmd.Parameters.AddWithValue("native_transcript_available", (object?)mediaSource.NativeTranscriptAvailable ?? DBNull.Value);
            cmd.Parameters.AddWithValue("native_transcript_checked_at", (object?)mediaSource.NativeTranscriptCheckedAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("native_transcript_language", (object?)mediaSource.NativeTranscriptLanguage ?? DBNull.Value);
            cmd.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
            {
                Value = mediaSource.Metadata.ValueKind == JsonValueKind.Undefined ? "{}" : mediaSource.Metadata.GetRawText()
            });
            cmd.Parameters.AddWithValue("created_at", mediaSource.CreatedAt.UtcDateTime);
            cmd.Parameters.AddWithValue("updated_at", mediaSource.UpdatedAt.UtcDateTime);
        }, transaction, cancellationToken, MapMediaSource);

    public Task<MediaSource?> GetMediaSourceByIdAsync(Guid sourceId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("MediaSources/GetMediaSourceById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_id", sourceId);
        }, cancellationToken);

    public Task<MediaSource?> GetMediaSourceByIdentityAsync(string sourceProvider, string sourceKind, string externalSourceId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("MediaSources/GetMediaSourceByIdentity.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_provider", sourceProvider);
            cmd.Parameters.AddWithValue("source_kind", sourceKind);
            cmd.Parameters.AddWithValue("external_source_id", externalSourceId);
        }, cancellationToken);

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

    private async Task<MediaSource?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapMediaSource(reader) : null;
    }

    private static MediaSource MapMediaSource(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            SourceProvider = reader.GetString(reader.GetOrdinal("source_provider")),
            SourceKind = reader.GetString(reader.GetOrdinal("source_kind")),
            ExternalSourceId = reader.GetString(reader.GetOrdinal("external_source_id")),
            CanonicalUrl = reader.GetString(reader.GetOrdinal("canonical_url")),
            OriginalUrl = reader.GetString(reader.GetOrdinal("original_url")),
            DurationSeconds = reader.IsDBNull(reader.GetOrdinal("duration_seconds")) ? null : reader.GetDecimal(reader.GetOrdinal("duration_seconds")),
            NativeTranscriptAvailable = reader.IsDBNull(reader.GetOrdinal("native_transcript_available")) ? null : reader.GetBoolean(reader.GetOrdinal("native_transcript_available")),
            NativeTranscriptCheckedAt = reader.IsDBNull(reader.GetOrdinal("native_transcript_checked_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("native_transcript_checked_at")),
            NativeTranscriptLanguage = reader.IsDBNull(reader.GetOrdinal("native_transcript_language")) ? null : reader.GetString(reader.GetOrdinal("native_transcript_language")),
            Metadata = ParseJson(reader.GetString(reader.GetOrdinal("metadata_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
