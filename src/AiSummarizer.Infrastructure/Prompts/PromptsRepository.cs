using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Prompts;
using AiSummarizer.Domain.Prompts;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Prompts;

public sealed class PromptsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IPromptsRepository
{
    public Task<Prompt> CreatePromptAsync(Prompt prompt, CancellationToken cancellationToken)
        => ExecuteWithConflictTranslationAsync(() => QuerySingleAsync("Prompts/CreatePrompt.sql", cmd => BindPrompt(cmd, prompt), cancellationToken));

    public Task<Prompt?> GetPromptByIdAsync(Guid promptId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Prompts/GetPromptById.sql", cmd => cmd.Parameters.AddWithValue("prompt_id", promptId), cancellationToken);

    public Task<Prompt?> GetPromptByKeyAsync(string promptKey, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Prompts/GetPromptByKey.sql", cmd => cmd.Parameters.AddWithValue("prompt_key", promptKey), cancellationToken);

    public Task<IReadOnlyList<Prompt>> ListPromptsAsync(int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Prompts/ListPrompts.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<Prompt> UpdatePromptAsync(Prompt prompt, CancellationToken cancellationToken)
        => ExecuteWithConflictTranslationAsync(() => QuerySingleAsync("Prompts/UpdatePrompt.sql", cmd => BindPrompt(cmd, prompt), cancellationToken));

    public async Task DeletePromptAsync(Guid promptId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("Prompts/DeletePrompt.sql"), connection);
        command.Parameters.AddWithValue("prompt_id", promptId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public Task<IReadOnlyList<PromptArchive>> ListPromptArchivesAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Prompts/ListPromptArchives.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("prompt_id", promptId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapPromptArchive);

    public Task<IReadOnlyList<PromptRun>> ListPromptRunsAsync(Guid promptId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Prompts/ListPromptRuns.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("prompt_id", promptId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapPromptRun);

    public Task<PromptRun> CreatePromptRunAsync(PromptRun promptRun, CancellationToken cancellationToken)
        => ExecuteWithConflictTranslationAsync(() => QuerySingleAsync("Prompts/CreatePromptRun.sql", cmd => BindPromptRun(cmd, promptRun), cancellationToken, MapPromptRun));

    public Task<PromptRunUsage> GetPromptRunUsageAsync(Guid promptId, CancellationToken cancellationToken)
        => QuerySingleAsync("Prompts/GetPromptRunUsage.sql", cmd => cmd.Parameters.AddWithValue("prompt_id", promptId), cancellationToken, MapPromptRunUsage);

    private async Task<Prompt?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapPrompt(reader) : null;
    }

    private async Task<IReadOnlyList<Prompt>> QueryManyAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<Prompt>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapPrompt(reader));
        }

        return items;
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

    private async Task<Prompt> QuerySingleAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        var item = await QuerySingleOrDefaultAsync(sqlPath, configure, cancellationToken);
        return item ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
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

    private static async Task<T> ExecuteWithConflictTranslationAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new PromptConflictException("A prompt with this key already exists.");
        }
    }

    private static void BindPrompt(NpgsqlCommand command, Prompt prompt)
    {
        command.Parameters.AddWithValue("id", prompt.Id);
        command.Parameters.AddWithValue("prompt_key", prompt.PromptKey);
        command.Parameters.AddWithValue("title", prompt.Title);
        command.Parameters.AddWithValue("description", (object?)prompt.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("workflow_type", (object?)prompt.WorkflowType ?? DBNull.Value);
        command.Parameters.AddWithValue("provider", prompt.Provider);
        command.Parameters.AddWithValue("model", prompt.Model);
        command.Parameters.AddWithValue("system_prompt", prompt.SystemPrompt);
        command.Parameters.AddWithValue("user_prompt", prompt.UserPrompt);
        command.Parameters.AddWithValue("is_active", prompt.IsActive);
        command.Parameters.AddWithValue("created_at", prompt.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", prompt.UpdatedAt.UtcDateTime);
    }

    private static void BindPromptRun(NpgsqlCommand command, PromptRun promptRun)
    {
        command.Parameters.AddWithValue("id", promptRun.Id);
        command.Parameters.AddWithValue("prompt_id", promptRun.PromptId);
        command.Parameters.AddWithValue("workflow_id", (object?)promptRun.WorkflowId ?? DBNull.Value);
        command.Parameters.AddWithValue("step_key", (object?)promptRun.StepKey ?? DBNull.Value);
        command.Parameters.AddWithValue("prompt_key", promptRun.PromptKey);
        command.Parameters.AddWithValue("title", promptRun.Title);
        command.Parameters.AddWithValue("workflow_type", (object?)promptRun.WorkflowType ?? DBNull.Value);
        command.Parameters.AddWithValue("provider", promptRun.Provider);
        command.Parameters.AddWithValue("model", promptRun.Model);
        command.Parameters.Add(new NpgsqlParameter("request_json", NpgsqlDbType.Jsonb)
        {
            Value = promptRun.Request.ValueKind == JsonValueKind.Undefined ? "{}" : promptRun.Request.GetRawText()
        });
        command.Parameters.Add(new NpgsqlParameter("response_json", NpgsqlDbType.Jsonb)
        {
            Value = promptRun.Response is null ? DBNull.Value : promptRun.Response.Value.GetRawText()
        });
        command.Parameters.AddWithValue("status", promptRun.Status);
        command.Parameters.AddWithValue("error_code", (object?)promptRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)promptRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("input_tokens", (object?)promptRun.InputTokens ?? DBNull.Value);
        command.Parameters.AddWithValue("output_tokens", (object?)promptRun.OutputTokens ?? DBNull.Value);
        command.Parameters.AddWithValue("total_tokens", (object?)promptRun.TotalTokens ?? DBNull.Value);
        command.Parameters.AddWithValue("duration_ms", (object?)promptRun.DurationMs ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", promptRun.StartedAt.UtcDateTime);
        command.Parameters.AddWithValue("finished_at", (object?)promptRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", promptRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", promptRun.UpdatedAt.UtcDateTime);
    }

    private static Prompt MapPrompt(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            PromptKey = reader.GetString(reader.GetOrdinal("prompt_key")),
            Title = reader.GetString(reader.GetOrdinal("title")),
            Description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            WorkflowType = reader.IsDBNull(reader.GetOrdinal("workflow_type")) ? null : reader.GetString(reader.GetOrdinal("workflow_type")),
            Provider = reader.GetString(reader.GetOrdinal("provider")),
            Model = reader.GetString(reader.GetOrdinal("model")),
            SystemPrompt = reader.GetString(reader.GetOrdinal("system_prompt")),
            UserPrompt = reader.GetString(reader.GetOrdinal("user_prompt")),
            IsActive = reader.GetBoolean(reader.GetOrdinal("is_active")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static PromptArchive MapPromptArchive(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            PromptId = reader.GetGuid(reader.GetOrdinal("prompt_id")),
            ArchiveVersion = reader.GetInt32(reader.GetOrdinal("archive_version")),
            ArchiveReason = reader.GetString(reader.GetOrdinal("archive_reason")),
            PromptKey = reader.GetString(reader.GetOrdinal("prompt_key")),
            Title = reader.GetString(reader.GetOrdinal("title")),
            Description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            WorkflowType = reader.IsDBNull(reader.GetOrdinal("workflow_type")) ? null : reader.GetString(reader.GetOrdinal("workflow_type")),
            Provider = reader.GetString(reader.GetOrdinal("provider")),
            Model = reader.GetString(reader.GetOrdinal("model")),
            SystemPrompt = reader.GetString(reader.GetOrdinal("system_prompt")),
            UserPrompt = reader.GetString(reader.GetOrdinal("user_prompt")),
            IsActive = reader.GetBoolean(reader.GetOrdinal("is_active")),
            ArchivedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("archived_at")),
            SourceUpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("source_updated_at"))
        };

    private static PromptRun MapPromptRun(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            PromptId = reader.GetGuid(reader.GetOrdinal("prompt_id")),
            WorkflowId = reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            StepKey = reader.IsDBNull(reader.GetOrdinal("step_key")) ? null : reader.GetString(reader.GetOrdinal("step_key")),
            PromptKey = reader.GetString(reader.GetOrdinal("prompt_key")),
            Title = reader.GetString(reader.GetOrdinal("title")),
            WorkflowType = reader.IsDBNull(reader.GetOrdinal("workflow_type")) ? null : reader.GetString(reader.GetOrdinal("workflow_type")),
            Provider = reader.GetString(reader.GetOrdinal("provider")),
            Model = reader.GetString(reader.GetOrdinal("model")),
            Request = JsonDocument.Parse(reader.GetString(reader.GetOrdinal("request_json"))).RootElement.Clone(),
            Response = reader.IsDBNull(reader.GetOrdinal("response_json")) ? null : JsonDocument.Parse(reader.GetString(reader.GetOrdinal("response_json"))).RootElement.Clone(),
            Status = reader.GetString(reader.GetOrdinal("status")),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            InputTokens = reader.IsDBNull(reader.GetOrdinal("input_tokens")) ? null : reader.GetInt32(reader.GetOrdinal("input_tokens")),
            OutputTokens = reader.IsDBNull(reader.GetOrdinal("output_tokens")) ? null : reader.GetInt32(reader.GetOrdinal("output_tokens")),
            TotalTokens = reader.IsDBNull(reader.GetOrdinal("total_tokens")) ? null : reader.GetInt32(reader.GetOrdinal("total_tokens")),
            DurationMs = reader.IsDBNull(reader.GetOrdinal("duration_ms")) ? null : reader.GetInt32(reader.GetOrdinal("duration_ms")),
            StartedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static PromptRunUsage MapPromptRunUsage(NpgsqlDataReader reader)
        => new()
        {
            PromptId = reader.GetGuid(reader.GetOrdinal("prompt_id")),
            TotalRuns = reader.GetInt32(reader.GetOrdinal("total_runs")),
            SucceededRuns = reader.GetInt32(reader.GetOrdinal("succeeded_runs")),
            FailedRuns = reader.GetInt32(reader.GetOrdinal("failed_runs")),
            RunningRuns = reader.GetInt32(reader.GetOrdinal("running_runs")),
            LastRunAt = reader.IsDBNull(reader.GetOrdinal("last_run_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_run_at")),
            LastStatus = reader.IsDBNull(reader.GetOrdinal("last_status")) ? null : reader.GetString(reader.GetOrdinal("last_status"))
        };
}
