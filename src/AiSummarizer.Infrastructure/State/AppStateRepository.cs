using System.Text.Json;
using AiSummarizer.Application.State;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.State;

public sealed class AppStateRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IAppStateRepository
{
    public async Task<JsonElement?> GetStateAsync(string stateKey, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("AppStates/GetAppState.sql"), connection);
        command.Parameters.AddWithValue("state_key", stateKey);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return ParseJson(reader.GetString(reader.GetOrdinal("state_json")));
    }

    public async Task UpsertStateAsync(string stateKey, JsonElement state, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("AppStates/UpsertAppState.sql"), connection);
        command.Parameters.AddWithValue("state_key", stateKey);
        command.Parameters.Add(new NpgsqlParameter("state_json", NpgsqlDbType.Jsonb)
        {
            Value = state.ValueKind == JsonValueKind.Undefined ? "{}" : state.GetRawText()
        });
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
