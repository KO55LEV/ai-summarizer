using System.Data.Common;
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

    private async Task<Prompt> QuerySingleAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        var item = await QuerySingleOrDefaultAsync(sqlPath, configure, cancellationToken);
        return item ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private static async Task<Prompt> ExecuteWithConflictTranslationAsync(Func<Task<Prompt>> action)
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
}
