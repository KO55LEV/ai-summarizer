using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Transcripts;
using AiSummarizer.Domain.Transcripts;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Transcripts;

public sealed class TranscriptsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : ITranscriptsRepository
{
    public async Task<T> ExecuteInTransactionAsync<T>(Func<ITranscriptsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
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

    public Task<Transcript> UpsertTranscriptAsync(Transcript transcript, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Transcripts/UpsertTranscript.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("id", transcript.Id);
            cmd.Parameters.AddWithValue("job_id", transcript.JobId);
            cmd.Parameters.AddWithValue("source_id", (object?)transcript.SourceId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("source_job_id", (object?)transcript.SourceJobId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("source_url", (object?)transcript.SourceUrl ?? DBNull.Value);
            cmd.Parameters.AddWithValue("source_file_path", transcript.SourceFilePath);
            cmd.Parameters.AddWithValue("transcript_file_path", transcript.TranscriptFilePath);
            cmd.Parameters.AddWithValue("language", transcript.Language);
            cmd.Parameters.AddWithValue("language_probability", transcript.LanguageProbability);
            cmd.Parameters.AddWithValue("duration_seconds", transcript.DurationSeconds);
            cmd.Parameters.AddWithValue("segment_count", transcript.SegmentCount);
            cmd.Parameters.AddWithValue("word_count", transcript.WordCount);
            cmd.Parameters.AddWithValue("character_count", transcript.CharacterCount);
            cmd.Parameters.AddWithValue("transcript_text", transcript.TranscriptText);
            cmd.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
            {
                Value = transcript.Metadata.ValueKind == JsonValueKind.Undefined ? "{}" : transcript.Metadata.GetRawText()
            });
        }, transaction, cancellationToken, MapTranscript);

    public Task<Transcript?> GetTranscriptBySourceUrlAsync(string sourceUrl, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Transcripts/GetTranscriptBySourceUrl.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_url", sourceUrl);
        }, cancellationToken);

    public Task<Transcript?> GetTranscriptBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Transcripts/GetTranscriptBySourceId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_id", sourceId);
        }, cancellationToken);

    public Task DeleteTranscriptSegmentsAsync(Guid transcriptId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteAsync("Transcripts/DeleteTranscriptSegments.sql", cmd => cmd.Parameters.AddWithValue("transcript_id", transcriptId), transaction, cancellationToken);

    public Task CreateTranscriptSegmentsAsync(IReadOnlyList<TranscriptSegment> segments, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteSegmentsAsync(segments, transaction, cancellationToken);

    private async Task ExecuteSegmentsAsync(IReadOnlyList<TranscriptSegment> segments, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (segments.Count == 0)
        {
            return;
        }

        if (transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load("Transcripts/CreateTranscriptSegment.sql"), connection);
            foreach (var segment in segments)
            {
                command.Parameters.Clear();
                BindTranscriptSegment(command, segment);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            return;
        }

        var txConnection = (NpgsqlConnection)transaction.Connection ?? throw new InvalidOperationException("Transaction is not associated with a connection.");
        await using (var command = new NpgsqlCommand(sqlScriptLoader.Load("Transcripts/CreateTranscriptSegment.sql"), txConnection, (NpgsqlTransaction)transaction))
        {
            foreach (var segment in segments)
            {
                command.Parameters.Clear();
                BindTranscriptSegment(command, segment);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }

    private async Task ExecuteAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        var txConnection = (NpgsqlConnection)transaction.Connection ?? throw new InvalidOperationException("Transaction is not associated with a connection.");
        await using (var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, (NpgsqlTransaction)transaction))
        {
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task<T> QuerySingleAsync<T>(
        string sqlPath,
        Action<NpgsqlCommand> configure,
        DbTransaction? transaction,
        CancellationToken cancellationToken,
        Func<NpgsqlDataReader, T> mapper)
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

    private async Task<Transcript?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapTranscript(reader) : null;
    }

    private static void BindTranscriptSegment(NpgsqlCommand command, TranscriptSegment segment)
    {
        command.Parameters.AddWithValue("id", segment.Id);
        command.Parameters.AddWithValue("transcript_id", segment.TranscriptId);
        command.Parameters.AddWithValue("segment_index", segment.SegmentIndex);
        command.Parameters.AddWithValue("start_seconds", segment.StartSeconds);
        command.Parameters.AddWithValue("end_seconds", segment.EndSeconds);
        command.Parameters.AddWithValue("text_offset_start", segment.TextOffsetStart);
        command.Parameters.AddWithValue("text_offset_end", segment.TextOffsetEnd);
        command.Parameters.AddWithValue("text", segment.Text);
        command.Parameters.AddWithValue("speaker_label", (object?)segment.SpeakerLabel ?? DBNull.Value);
        command.Parameters.AddWithValue("word_count", segment.WordCount);
        command.Parameters.AddWithValue("character_count", segment.CharacterCount);
        command.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = segment.Metadata.ValueKind == JsonValueKind.Undefined ? "{}" : segment.Metadata.GetRawText()
        });
    }

    private static Transcript MapTranscript(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            JobId = reader.GetGuid(reader.GetOrdinal("job_id")),
            SourceId = reader.IsDBNull(reader.GetOrdinal("source_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_id")),
            SourceJobId = reader.IsDBNull(reader.GetOrdinal("source_job_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_job_id")),
            SourceUrl = reader.IsDBNull(reader.GetOrdinal("source_url")) ? null : reader.GetString(reader.GetOrdinal("source_url")),
            SourceFilePath = reader.IsDBNull(reader.GetOrdinal("source_file_path")) ? null : reader.GetString(reader.GetOrdinal("source_file_path")),
            TranscriptFilePath = reader.GetString(reader.GetOrdinal("transcript_file_path")),
            Language = reader.GetString(reader.GetOrdinal("language")),
            LanguageProbability = reader.GetDecimal(reader.GetOrdinal("language_probability")),
            DurationSeconds = reader.GetDecimal(reader.GetOrdinal("duration_seconds")),
            SegmentCount = reader.GetInt32(reader.GetOrdinal("segment_count")),
            WordCount = reader.GetInt32(reader.GetOrdinal("word_count")),
            CharacterCount = reader.GetInt32(reader.GetOrdinal("character_count")),
            TranscriptText = reader.GetString(reader.GetOrdinal("transcript_text")),
            Metadata = ParseJson(reader.GetString(reader.GetOrdinal("metadata_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
