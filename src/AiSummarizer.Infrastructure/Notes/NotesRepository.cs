using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Notes;
using AiSummarizer.Domain.Notes;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Notes;

public sealed class NotesRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : INotesRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private NotesRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<INotesRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new NotesRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

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

    public Task<Note?> GetNoteByIdAsync(Guid noteId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetNoteById.sql", cmd => cmd.Parameters.AddWithValue("note_id", noteId), null, cancellationToken, MapNote);

    public Task<NoteAsset?> GetNoteAssetByIdAsync(Guid noteAssetId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetNoteAssetById.sql", cmd => cmd.Parameters.AddWithValue("note_asset_id", noteAssetId), null, cancellationToken, MapNoteAsset);

    public Task<IReadOnlyList<Note>> ListNotesAsync(Guid? requestedByUserId, Guid? projectId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Notes/ListNotes.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)requestedByUserId ?? DBNull.Value
            });
            cmd.Parameters.Add(new NpgsqlParameter("project_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)projectId ?? DBNull.Value
            });
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, null, cancellationToken, MapNote);

    public Task<Note> CreateNoteAsync(Note note, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/CreateNote.sql", cmd => BindNote(cmd, note), transaction, cancellationToken, MapNote);

    public Task<Note> UpdateNoteAsync(Note note, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/UpdateNote.sql", cmd => BindNote(cmd, note), transaction, cancellationToken, MapNote);

    public Task DeleteNoteAsync(Guid noteId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Notes/DeleteNote.sql", cmd => cmd.Parameters.AddWithValue("note_id", noteId), transaction, cancellationToken);

    public Task<NoteInput?> GetNoteInputByIdAsync(Guid noteInputId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetNoteInputById.sql", cmd => cmd.Parameters.AddWithValue("note_input_id", noteInputId), null, cancellationToken, MapNoteInput);

    public Task<NoteInput?> GetNoteInputByExternalIdentityAsync(string sourceChannel, string externalSourceId, string externalMessageId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetNoteInputByExternalIdentity.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_channel", sourceChannel);
            cmd.Parameters.AddWithValue("external_source_id", externalSourceId);
            cmd.Parameters.AddWithValue("external_message_id", externalMessageId);
        }, null, cancellationToken, MapNoteInput);

    public Task<IReadOnlyList<NoteInput>> ListNoteInputsAsync(Guid noteId, CancellationToken cancellationToken)
        => QueryManyAsync("Notes/ListNoteInputs.sql", cmd => cmd.Parameters.AddWithValue("note_id", noteId), null, cancellationToken, MapNoteInput);

    public Task<NoteInput> CreateNoteInputAsync(NoteInput noteInput, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/CreateNoteInput.sql", cmd => BindNoteInput(cmd, noteInput), transaction, cancellationToken, MapNoteInput);

    public Task<NoteInput> UpdateNoteInputAsync(NoteInput noteInput, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/UpdateNoteInput.sql", cmd => BindNoteInput(cmd, noteInput), transaction, cancellationToken, MapNoteInput);

    public Task<NoteAsset> CreateNoteAssetAsync(NoteAsset noteAsset, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/CreateNoteAsset.sql", cmd => BindNoteAsset(cmd, noteAsset), transaction, cancellationToken, MapNoteAsset);

    public Task<IReadOnlyList<NoteAsset>> ListNoteAssetsAsync(Guid noteId, CancellationToken cancellationToken)
        => QueryManyAsync("Notes/ListNoteAssets.sql", cmd => cmd.Parameters.AddWithValue("note_id", noteId), null, cancellationToken, MapNoteAsset);

    public Task<NoteTextVersion> CreateNoteTextVersionAsync(NoteTextVersion noteTextVersion, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/CreateNoteTextVersion.sql", cmd => BindNoteTextVersion(cmd, noteTextVersion), transaction, cancellationToken, MapNoteTextVersion);

    public Task<IReadOnlyList<NoteTextVersion>> ListNoteTextVersionsAsync(Guid noteId, CancellationToken cancellationToken)
        => QueryManyAsync("Notes/ListNoteTextVersions.sql", cmd => cmd.Parameters.AddWithValue("note_id", noteId), null, cancellationToken, MapNoteTextVersion);

    public Task<NoteProcessingRun> CreateNoteProcessingRunAsync(NoteProcessingRun noteProcessingRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/CreateNoteProcessingRun.sql", cmd => BindNoteProcessingRun(cmd, noteProcessingRun), transaction, cancellationToken, MapNoteProcessingRun);

    public Task<NoteProcessingRun?> GetNoteProcessingRunByIdAsync(Guid noteProcessingRunId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetNoteProcessingRunById.sql", cmd => cmd.Parameters.AddWithValue("note_processing_run_id", noteProcessingRunId), null, cancellationToken, MapNoteProcessingRun);

    public Task<NoteProcessingRun> UpdateNoteProcessingRunAsync(NoteProcessingRun noteProcessingRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/UpdateNoteProcessingRun.sql", cmd => BindNoteProcessingRun(cmd, noteProcessingRun), transaction, cancellationToken, MapNoteProcessingRun);

    public Task<IReadOnlyList<NoteProcessingRun>> ListNoteProcessingRunsAsync(Guid noteId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Notes/ListNoteProcessingRuns.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("note_id", noteId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, null, cancellationToken, MapNoteProcessingRun);

    public Task<TelegramAccount?> GetTelegramAccountByIdAsync(Guid telegramAccountId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetTelegramAccountById.sql", cmd => cmd.Parameters.AddWithValue("telegram_account_id", telegramAccountId), null, cancellationToken, MapTelegramAccount);

    public Task<TelegramAccount?> GetTelegramAccountByTelegramUserIdAsync(long telegramUserId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetTelegramAccountByTelegramUserId.sql", cmd => cmd.Parameters.AddWithValue("telegram_user_id", telegramUserId), null, cancellationToken, MapTelegramAccount);

    public Task<TelegramAccount> UpsertTelegramAccountAsync(TelegramAccount telegramAccount, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/UpsertTelegramAccount.sql", cmd => BindTelegramAccount(cmd, telegramAccount), transaction, cancellationToken, MapTelegramAccount);

    public Task<UserTelegramAccount?> GetUserTelegramAccountByUserIdAsync(Guid userId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetUserTelegramAccountByUserId.sql", cmd => cmd.Parameters.AddWithValue("requested_by_user_id", userId), null, cancellationToken, MapUserTelegramAccount);

    public Task<UserTelegramAccount?> GetUserTelegramAccountByTelegramAccountIdAsync(Guid telegramAccountId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Notes/GetUserTelegramAccountByTelegramAccountId.sql", cmd => cmd.Parameters.AddWithValue("telegram_account_id", telegramAccountId), null, cancellationToken, MapUserTelegramAccount);

    public Task<UserTelegramAccount> LinkUserTelegramAccountAsync(UserTelegramAccount link, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Notes/LinkUserTelegramAccount.sql", cmd => BindUserTelegramAccount(cmd, link), transaction, cancellationToken, MapUserTelegramAccount);

    public Task RevokeUserTelegramAccountAsync(Guid userTelegramAccountId, DateTimeOffset revokedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Notes/RevokeUserTelegramAccount.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("id", userTelegramAccountId);
            cmd.Parameters.AddWithValue("revoked_at", revokedAt.UtcDateTime);
        }, transaction, cancellationToken);

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

        await using var commandTx = CreateCommand(sqlPath, transaction);
        configure(commandTx);
        await using var readerTx = await commandTx.ExecuteReaderAsync(cancellationToken);
        return await readerTx.ReadAsync(cancellationToken) ? mapper(readerTx) : default;
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

        await using var commandTx = CreateCommand(sqlPath, transaction);
        configure(commandTx);
        await using var readerTx = await commandTx.ExecuteReaderAsync(cancellationToken);
        var txItems = new List<T>();
        while (await readerTx.ReadAsync(cancellationToken))
        {
            txItems.Add(mapper(readerTx));
        }

        return txItems;
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

    private static void BindNote(NpgsqlCommand command, Note note)
    {
        command.Parameters.AddWithValue("id", note.Id);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)note.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("project_id", (object?)note.ProjectId ?? DBNull.Value);
        command.Parameters.AddWithValue("title", note.Title);
        command.Parameters.AddWithValue("status", note.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("source_channel", note.SourceChannel.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("input_kind", note.InputKind.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("primary_language", (object?)note.PrimaryLanguage ?? DBNull.Value);
        command.Parameters.AddWithValue("current_text_version_id", (object?)note.CurrentTextVersionId ?? DBNull.Value);
        command.Parameters.AddWithValue("summary", (object?)note.Summary ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", note.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", note.UpdatedAt.UtcDateTime);
    }

    private static void BindNoteInput(NpgsqlCommand command, NoteInput noteInput)
    {
        command.Parameters.AddWithValue("id", noteInput.Id);
        command.Parameters.AddWithValue("note_id", noteInput.NoteId);
        command.Parameters.AddWithValue("source_channel", noteInput.SourceChannel.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("external_source_id", (object?)noteInput.ExternalSourceId ?? DBNull.Value);
        command.Parameters.AddWithValue("external_message_id", (object?)noteInput.ExternalMessageId ?? DBNull.Value);
        command.Parameters.AddWithValue("input_kind", noteInput.InputKind.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("raw_text", (object?)noteInput.RawText ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("raw_payload_json", NpgsqlDbType.Jsonb)
        {
            Value = noteInput.RawPayload.ValueKind == JsonValueKind.Undefined ? "{}" : noteInput.RawPayload.GetRawText()
        });
        command.Parameters.AddWithValue("status", noteInput.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("received_at", noteInput.ReceivedAt.UtcDateTime);
        command.Parameters.AddWithValue("processed_at", (object?)noteInput.ProcessedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", noteInput.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", noteInput.UpdatedAt.UtcDateTime);
    }

    private static void BindNoteAsset(NpgsqlCommand command, NoteAsset noteAsset)
    {
        command.Parameters.AddWithValue("id", noteAsset.Id);
        command.Parameters.AddWithValue("note_id", noteAsset.NoteId);
        command.Parameters.AddWithValue("note_input_id", (object?)noteAsset.NoteInputId ?? DBNull.Value);
        command.Parameters.AddWithValue("asset_type", noteAsset.AssetType);
        command.Parameters.AddWithValue("mime_type", noteAsset.MimeType);
        command.Parameters.AddWithValue("storage_key", noteAsset.StorageKey);
        command.Parameters.AddWithValue("original_filename", (object?)noteAsset.OriginalFilename ?? DBNull.Value);
        command.Parameters.AddWithValue("size_bytes", (object?)noteAsset.SizeBytes ?? DBNull.Value);
        command.Parameters.AddWithValue("checksum_sha256", (object?)noteAsset.ChecksumSha256 ?? DBNull.Value);
        command.Parameters.AddWithValue("duration_seconds", (object?)noteAsset.DurationSeconds ?? DBNull.Value);
        command.Parameters.AddWithValue("width", (object?)noteAsset.Width ?? DBNull.Value);
        command.Parameters.AddWithValue("height", (object?)noteAsset.Height ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = noteAsset.Metadata.ValueKind == JsonValueKind.Undefined ? "{}" : noteAsset.Metadata.GetRawText()
        });
    }

    private static void BindNoteTextVersion(NpgsqlCommand command, NoteTextVersion noteTextVersion)
    {
        command.Parameters.AddWithValue("id", noteTextVersion.Id);
        command.Parameters.AddWithValue("note_id", noteTextVersion.NoteId);
        command.Parameters.AddWithValue("source_asset_id", (object?)noteTextVersion.SourceAssetId ?? DBNull.Value);
        command.Parameters.AddWithValue("source_run_id", (object?)noteTextVersion.SourceRunId ?? DBNull.Value);
        command.Parameters.AddWithValue("version_kind", noteTextVersion.VersionKind.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("text", noteTextVersion.Text);
        command.Parameters.AddWithValue("language", (object?)noteTextVersion.Language ?? DBNull.Value);
        command.Parameters.AddWithValue("provider", (object?)noteTextVersion.Provider ?? DBNull.Value);
        command.Parameters.AddWithValue("model", (object?)noteTextVersion.Model ?? DBNull.Value);
        command.Parameters.AddWithValue("prompt_version", (object?)noteTextVersion.PromptVersion ?? DBNull.Value);
    }

    private static void BindNoteProcessingRun(NpgsqlCommand command, NoteProcessingRun run)
    {
        command.Parameters.AddWithValue("id", run.Id);
        command.Parameters.AddWithValue("note_id", run.NoteId);
        command.Parameters.AddWithValue("job_id", (object?)run.JobId ?? DBNull.Value);
        command.Parameters.AddWithValue("source_asset_id", (object?)run.SourceAssetId ?? DBNull.Value);
        command.Parameters.AddWithValue("stage", run.Stage.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("status", run.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("provider", (object?)run.Provider ?? DBNull.Value);
        command.Parameters.AddWithValue("model", (object?)run.Model ?? DBNull.Value);
        command.Parameters.AddWithValue("prompt_version", (object?)run.PromptVersion ?? DBNull.Value);
        command.Parameters.AddWithValue("input_hash", (object?)run.InputHash ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("request_json", NpgsqlDbType.Jsonb) { Value = JsonValue(run.Request) });
        command.Parameters.Add(new NpgsqlParameter("response_json", NpgsqlDbType.Jsonb) { Value = JsonValue(run.Response) });
        command.Parameters.Add(new NpgsqlParameter("output_json", NpgsqlDbType.Jsonb) { Value = JsonValue(run.Output) });
        command.Parameters.Add(new NpgsqlParameter("usage_json", NpgsqlDbType.Jsonb) { Value = JsonValue(run.Usage) });
        command.Parameters.Add(new NpgsqlParameter("metrics_json", NpgsqlDbType.Jsonb) { Value = JsonValue(run.Metrics) });
        command.Parameters.AddWithValue("error_code", (object?)run.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)run.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", (object?)run.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)run.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", run.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", run.UpdatedAt.UtcDateTime);
    }

    private static void BindTelegramAccount(NpgsqlCommand command, TelegramAccount telegramAccount)
    {
        command.Parameters.AddWithValue("id", telegramAccount.Id);
        command.Parameters.AddWithValue("telegram_user_id", telegramAccount.TelegramUserId);
        command.Parameters.AddWithValue("username", (object?)telegramAccount.Username ?? DBNull.Value);
        command.Parameters.AddWithValue("first_name", (object?)telegramAccount.FirstName ?? DBNull.Value);
        command.Parameters.AddWithValue("last_name", (object?)telegramAccount.LastName ?? DBNull.Value);
        command.Parameters.AddWithValue("display_name", (object?)telegramAccount.DisplayName ?? DBNull.Value);
        command.Parameters.AddWithValue("language_code", (object?)telegramAccount.LanguageCode ?? DBNull.Value);
        command.Parameters.AddWithValue("is_bot", telegramAccount.IsBot);
        command.Parameters.AddWithValue("last_seen_at", (object?)telegramAccount.LastSeenAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = telegramAccount.Metadata.ValueKind == JsonValueKind.Undefined ? "{}" : telegramAccount.Metadata.GetRawText()
        });
        command.Parameters.AddWithValue("created_at", telegramAccount.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", telegramAccount.UpdatedAt.UtcDateTime);
    }

    private static void BindUserTelegramAccount(NpgsqlCommand command, UserTelegramAccount link)
    {
        command.Parameters.AddWithValue("id", link.Id);
        command.Parameters.AddWithValue("requested_by_user_id", link.RequestedByUserId);
        command.Parameters.AddWithValue("telegram_account_id", link.TelegramAccountId);
        command.Parameters.AddWithValue("linked_at", link.LinkedAt.UtcDateTime);
        command.Parameters.AddWithValue("revoked_at", (object?)link.RevokedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", link.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", link.UpdatedAt.UtcDateTime);
    }

    private static JsonElement JsonValue(JsonElement? value)
        => value is null ? EmptyJson() : value.Value.ValueKind == JsonValueKind.Undefined ? EmptyJson() : value.Value.Clone();

    private static JsonElement EmptyJson() => JsonDocument.Parse("{}").RootElement.Clone();

    private static Note MapNote(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            ProjectId = reader.IsDBNull(reader.GetOrdinal("project_id")) ? null : reader.GetGuid(reader.GetOrdinal("project_id")),
            Title = reader.GetString(reader.GetOrdinal("title")),
            Status = Enum.Parse<NoteStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            SourceChannel = Enum.Parse<NoteSourceChannel>(reader.GetString(reader.GetOrdinal("source_channel")), true),
            InputKind = Enum.Parse<NoteInputKind>(reader.GetString(reader.GetOrdinal("input_kind")), true),
            PrimaryLanguage = reader.IsDBNull(reader.GetOrdinal("primary_language")) ? null : reader.GetString(reader.GetOrdinal("primary_language")),
            CurrentTextVersionId = reader.IsDBNull(reader.GetOrdinal("current_text_version_id")) ? null : reader.GetGuid(reader.GetOrdinal("current_text_version_id")),
            Summary = reader.IsDBNull(reader.GetOrdinal("summary")) ? null : reader.GetString(reader.GetOrdinal("summary")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static NoteInput MapNoteInput(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            NoteId = reader.GetGuid(reader.GetOrdinal("note_id")),
            SourceChannel = Enum.Parse<NoteSourceChannel>(reader.GetString(reader.GetOrdinal("source_channel")), true),
            ExternalSourceId = reader.IsDBNull(reader.GetOrdinal("external_source_id")) ? null : reader.GetString(reader.GetOrdinal("external_source_id")),
            ExternalMessageId = reader.IsDBNull(reader.GetOrdinal("external_message_id")) ? null : reader.GetString(reader.GetOrdinal("external_message_id")),
            InputKind = Enum.Parse<NoteInputKind>(reader.GetString(reader.GetOrdinal("input_kind")), true),
            RawText = reader.IsDBNull(reader.GetOrdinal("raw_text")) ? null : reader.GetString(reader.GetOrdinal("raw_text")),
            RawPayload = ParseJson(reader.GetString(reader.GetOrdinal("raw_payload_json"))),
            Status = Enum.Parse<NoteInputStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            ReceivedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("received_at")),
            ProcessedAt = reader.IsDBNull(reader.GetOrdinal("processed_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("processed_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static NoteAsset MapNoteAsset(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            NoteId = reader.GetGuid(reader.GetOrdinal("note_id")),
            NoteInputId = reader.IsDBNull(reader.GetOrdinal("note_input_id")) ? null : reader.GetGuid(reader.GetOrdinal("note_input_id")),
            AssetType = reader.GetString(reader.GetOrdinal("asset_type")),
            MimeType = reader.GetString(reader.GetOrdinal("mime_type")),
            StorageKey = reader.GetString(reader.GetOrdinal("storage_key")),
            OriginalFilename = reader.IsDBNull(reader.GetOrdinal("original_filename")) ? null : reader.GetString(reader.GetOrdinal("original_filename")),
            SizeBytes = reader.IsDBNull(reader.GetOrdinal("size_bytes")) ? null : reader.GetInt64(reader.GetOrdinal("size_bytes")),
            ChecksumSha256 = reader.IsDBNull(reader.GetOrdinal("checksum_sha256")) ? null : reader.GetString(reader.GetOrdinal("checksum_sha256")),
            DurationSeconds = reader.IsDBNull(reader.GetOrdinal("duration_seconds")) ? null : reader.GetDecimal(reader.GetOrdinal("duration_seconds")),
            Width = reader.IsDBNull(reader.GetOrdinal("width")) ? null : reader.GetInt32(reader.GetOrdinal("width")),
            Height = reader.IsDBNull(reader.GetOrdinal("height")) ? null : reader.GetInt32(reader.GetOrdinal("height")),
            Metadata = ParseJson(reader.GetString(reader.GetOrdinal("metadata_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static NoteTextVersion MapNoteTextVersion(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            NoteId = reader.GetGuid(reader.GetOrdinal("note_id")),
            SourceAssetId = reader.IsDBNull(reader.GetOrdinal("source_asset_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_asset_id")),
            SourceRunId = reader.IsDBNull(reader.GetOrdinal("source_run_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_run_id")),
            VersionKind = Enum.Parse<NoteTextVersionKind>(reader.GetString(reader.GetOrdinal("version_kind")), true),
            Text = reader.GetString(reader.GetOrdinal("text")),
            Language = reader.IsDBNull(reader.GetOrdinal("language")) ? null : reader.GetString(reader.GetOrdinal("language")),
            Provider = reader.IsDBNull(reader.GetOrdinal("provider")) ? null : reader.GetString(reader.GetOrdinal("provider")),
            Model = reader.IsDBNull(reader.GetOrdinal("model")) ? null : reader.GetString(reader.GetOrdinal("model")),
            PromptVersion = reader.IsDBNull(reader.GetOrdinal("prompt_version")) ? null : reader.GetString(reader.GetOrdinal("prompt_version")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at"))
        };

    private static NoteProcessingRun MapNoteProcessingRun(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            NoteId = reader.GetGuid(reader.GetOrdinal("note_id")),
            JobId = reader.IsDBNull(reader.GetOrdinal("job_id")) ? null : reader.GetGuid(reader.GetOrdinal("job_id")),
            SourceAssetId = reader.IsDBNull(reader.GetOrdinal("source_asset_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_asset_id")),
            Stage = Enum.Parse<NoteProcessingStage>(reader.GetString(reader.GetOrdinal("stage")), true),
            Status = Enum.Parse<NoteProcessingStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            Provider = reader.IsDBNull(reader.GetOrdinal("provider")) ? null : reader.GetString(reader.GetOrdinal("provider")),
            Model = reader.IsDBNull(reader.GetOrdinal("model")) ? null : reader.GetString(reader.GetOrdinal("model")),
            PromptVersion = reader.IsDBNull(reader.GetOrdinal("prompt_version")) ? null : reader.GetString(reader.GetOrdinal("prompt_version")),
            InputHash = reader.IsDBNull(reader.GetOrdinal("input_hash")) ? null : reader.GetString(reader.GetOrdinal("input_hash")),
            Request = reader.IsDBNull(reader.GetOrdinal("request_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("request_json"))),
            Response = reader.IsDBNull(reader.GetOrdinal("response_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("response_json"))),
            Output = reader.IsDBNull(reader.GetOrdinal("output_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("output_json"))),
            Usage = reader.IsDBNull(reader.GetOrdinal("usage_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("usage_json"))),
            Metrics = reader.IsDBNull(reader.GetOrdinal("metrics_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("metrics_json"))),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            StartedAt = reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static TelegramAccount MapTelegramAccount(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            TelegramUserId = reader.GetInt64(reader.GetOrdinal("telegram_user_id")),
            Username = reader.IsDBNull(reader.GetOrdinal("username")) ? null : reader.GetString(reader.GetOrdinal("username")),
            FirstName = reader.IsDBNull(reader.GetOrdinal("first_name")) ? null : reader.GetString(reader.GetOrdinal("first_name")),
            LastName = reader.IsDBNull(reader.GetOrdinal("last_name")) ? null : reader.GetString(reader.GetOrdinal("last_name")),
            DisplayName = reader.IsDBNull(reader.GetOrdinal("display_name")) ? null : reader.GetString(reader.GetOrdinal("display_name")),
            LanguageCode = reader.IsDBNull(reader.GetOrdinal("language_code")) ? null : reader.GetString(reader.GetOrdinal("language_code")),
            IsBot = reader.GetBoolean(reader.GetOrdinal("is_bot")),
            LastSeenAt = reader.IsDBNull(reader.GetOrdinal("last_seen_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_seen_at")),
            Metadata = ParseJson(reader.GetString(reader.GetOrdinal("metadata_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static UserTelegramAccount MapUserTelegramAccount(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            TelegramAccountId = reader.GetGuid(reader.GetOrdinal("telegram_account_id")),
            LinkedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("linked_at")),
            RevokedAt = reader.IsDBNull(reader.GetOrdinal("revoked_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("revoked_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
