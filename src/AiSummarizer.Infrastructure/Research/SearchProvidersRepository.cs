using System.Text.Json;
using AiSummarizer.Application.Research;
using AiSummarizer.Domain.Research;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Research;

public sealed class SearchProvidersRepository(NpgsqlDataSource dataSource) : ISearchProviderRepository
{
    public async Task<IReadOnlyList<SearchProviderKeyDto>> ListKeysAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            select id, provider, api_key, quota_per_month, is_active, note
            from search_provider_keys
            order by created_at desc
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<SearchProviderKeyDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapKey(reader));
        }

        return items;
    }

    public async Task<SearchProviderKeyDto?> GetKeyAsync(Guid id, CancellationToken cancellationToken)
    {
        const string sql = """
            select id, provider, api_key, quota_per_month, is_active, note
            from search_provider_keys
            where id = @id
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapKey(reader) : null;
    }

    public async Task<SearchProviderKeyDto> CreateKeyAsync(SearchProviderKeyDto key, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into search_provider_keys (id, provider, api_key, quota_per_month, is_active, note, created_at, updated_at)
            values (@id, @provider, @api_key, @quota, @is_active, @note, now(), now())
            returning id, provider, api_key, quota_per_month, is_active, note
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        var id = key.Id == Guid.Empty ? Guid.NewGuid() : key.Id;
        command.Parameters.AddWithValue("id", id);
        BindKey(command, key with { Id = id });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return MapKey(reader);
    }

    public async Task<SearchProviderKeyDto?> UpdateKeyAsync(Guid id, SearchProviderKeyDto key, CancellationToken cancellationToken)
    {
        const string sql = """
            update search_provider_keys
            set provider = @provider,
                api_key = @api_key,
                quota_per_month = @quota,
                is_active = @is_active,
                note = @note,
                updated_at = now()
            where id = @id
            returning id, provider, api_key, quota_per_month, is_active, note
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        BindKey(command, key);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapKey(reader) : null;
    }

    public async Task DeleteKeyAsync(Guid id, CancellationToken cancellationToken)
    {
        const string sql = "delete from search_provider_keys where id = @id";
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<SearchProviderUsageDto> GetUsageAsync(Guid id, CancellationToken cancellationToken)
    {
        var cycleStart = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var cycleEnd = cycleStart.AddMonths(1);
        const string sql = """
            select
                k.id,
                k.provider,
                k.quota_per_month,
                coalesce(sum(case
                    when lower(l.provider) = 'tavily' then case
                        when (l.request_payload::jsonb ->> 'search_depth') = 'advanced' then 2
                        else 1
                    end
                    else 1
                end), 0) as used
            from search_provider_keys k
            left join search_provider_logs l
                on l.search_provider_key_id = k.id
               and l.created_at >= @cycle_start
               and l.created_at < @cycle_end
            where k.id = @id
            group by k.id, k.provider, k.quota_per_month
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("cycle_start", cycleStart.UtcDateTime);
        command.Parameters.AddWithValue("cycle_end", cycleEnd.UtcDateTime);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new SearchProviderUsageDto(id, string.Empty, 0, 0, cycleStart, cycleEnd);
        }

        return new SearchProviderUsageDto(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetString(reader.GetOrdinal("provider")),
            reader.GetInt32(reader.GetOrdinal("quota_per_month")),
            reader.GetInt32(reader.GetOrdinal("used")),
            cycleStart,
            cycleEnd);
    }

    public async Task LogRequestAsync(string provider, Guid? searchProviderKeyId, Guid? jobId, string requestPayload, int responseStatus, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into search_provider_logs (id, search_provider_key_id, job_id, provider, status_code, request_payload, created_at)
            values (@id, @search_provider_key_id, @job_id, @provider, @status_code, @request_payload, now())
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("search_provider_key_id", (object?)searchProviderKeyId ?? DBNull.Value);
        command.Parameters.AddWithValue("job_id", (object?)jobId ?? DBNull.Value);
        command.Parameters.AddWithValue("provider", provider);
        command.Parameters.AddWithValue("status_code", responseStatus);
        command.Parameters.AddWithValue("request_payload", string.IsNullOrWhiteSpace(requestPayload) ? "{}" : requestPayload);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void BindKey(NpgsqlCommand command, SearchProviderKeyDto key)
    {
        command.Parameters.AddWithValue("provider", key.Provider);
        command.Parameters.AddWithValue("api_key", key.ApiKey);
        command.Parameters.AddWithValue("quota", key.QuotaPerMonth);
        command.Parameters.AddWithValue("is_active", key.IsActive);
        command.Parameters.AddWithValue("note", (object?)key.Note ?? DBNull.Value);
    }

    private static SearchProviderKeyDto MapKey(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetString(reader.GetOrdinal("provider")),
            reader.GetString(reader.GetOrdinal("api_key")),
            reader.GetInt32(reader.GetOrdinal("quota_per_month")),
            reader.GetBoolean(reader.GetOrdinal("is_active")),
            reader.IsDBNull(reader.GetOrdinal("note")) ? null : reader.GetString(reader.GetOrdinal("note")));
}
