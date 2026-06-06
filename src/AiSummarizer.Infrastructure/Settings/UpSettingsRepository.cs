using System.Text.Json;
using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Settings;

public sealed class UpSettingsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IUpSettingsRepository
{
    public async Task<UpSettingDto?> GetAsync(string settingKey, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("UpSettings/GetUpSetting.sql"), connection);
        command.Parameters.AddWithValue("setting_key", settingKey);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new UpSettingDto(
            reader.GetString(reader.GetOrdinal("setting_key")),
            reader.GetString(reader.GetOrdinal("setting_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));
    }

    public async Task<UpSettingDto> UpsertAsync(string settingKey, string settingJson, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("UpSettings/UpsertUpSetting.sql"), connection);
        command.Parameters.AddWithValue("setting_key", settingKey);
        command.Parameters.Add(new NpgsqlParameter("setting_json", NpgsqlDbType.Jsonb)
        {
            Value = settingJson
        });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);

        return new UpSettingDto(
            reader.GetString(reader.GetOrdinal("setting_key")),
            reader.GetString(reader.GetOrdinal("setting_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));
    }
}
