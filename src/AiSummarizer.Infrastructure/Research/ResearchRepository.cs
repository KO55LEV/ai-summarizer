using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Research;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Research;

public sealed class ResearchRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IResearchRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private ResearchRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<IResearchRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new ResearchRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

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

    public Task<ResearchTopicDto?> GetTopicByIdAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Research/GetResearchTopicById.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, MapTopic);

    public Task<IReadOnlyList<ResearchTopicDto>> ListTopicsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Research/ListResearchTopics.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)requestedByUserId ?? DBNull.Value
            });
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapTopic);

    public Task<ResearchStatsDto> GetStatsAsync(Guid? requestedByUserId, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/GetResearchStats.sql", cmd =>
        {
            cmd.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
            {
                Value = (object?)requestedByUserId ?? DBNull.Value
            });
        }, cancellationToken, reader => new ResearchStatsDto(
            reader.GetInt32(reader.GetOrdinal("active_topics")),
            reader.GetInt32(reader.GetOrdinal("briefings_generated")),
            reader.GetInt32(reader.GetOrdinal("sources_tracked")),
            reader.GetInt32(reader.GetOrdinal("avg_read_time_minutes"))));

    public Task<Guid> CreateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/CreateResearchTopic.sql", cmd =>
        {
            BindTopic(cmd, topic);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<Guid> UpdateTopicAsync(ResearchTopicRecord topic, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/UpdateResearchTopic.sql", cmd =>
        {
            BindTopic(cmd, topic);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task DeleteTopicAsync(Guid topicId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/DeleteResearchTopic.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), transaction, cancellationToken);

    public Task ReplaceTopicSourcesAsync(Guid topicId, IReadOnlyList<string> sources, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/ReplaceResearchTopicSources.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.Add(new NpgsqlParameter("sources", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = sources.ToArray() });
        }, transaction, cancellationToken);

    public Task ReplaceTopicTagsAsync(Guid topicId, IReadOnlyList<string> tags, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/ReplaceResearchTopicTags.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.Add(new NpgsqlParameter("tags", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = tags.ToArray() });
        }, transaction, cancellationToken);

    public Task ReplaceTopicOutputsAsync(Guid topicId, IReadOnlyList<string> outputs, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/ReplaceResearchTopicOutputs.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.Add(new NpgsqlParameter("outputs", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = outputs.ToArray() });
        }, transaction, cancellationToken);

    public Task<int> GetBriefingCountAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/GetResearchBriefingCount.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, reader => reader.GetInt32(reader.GetOrdinal("briefing_count")));

    public Task<ResearchBriefingDto?> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Research/GetLatestResearchBriefing.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, MapBriefing);

    public Task<ResearchBriefingDto?> GetBriefingByIdAsync(Guid briefingId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Research/GetResearchBriefingById.sql", cmd => cmd.Parameters.AddWithValue("briefing_id", briefingId), cancellationToken, MapBriefing);

    public Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Research/ListResearchBriefingHistory.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, reader => new ResearchBriefingHistoryItemDto(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("generated_at")),
            reader.GetString(reader.GetOrdinal("preview_text"))));

    public Task<Guid> CreateBriefingAsync(ResearchBriefingRecord briefing, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/CreateResearchBriefing.sql", cmd =>
        {
            BindBriefing(cmd, briefing);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task ReplaceBriefingSectionsAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSectionInput> sections, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/ReplaceResearchBriefingSections.sql", cmd =>
        {
            var payload = sections.Select((section, index) => new
            {
                sectionOrder = index,
                title = section.Title,
                sentiment = section.Sentiment,
                items = section.Items
            }).ToArray();
            cmd.Parameters.AddWithValue("briefing_id", briefingId);
            cmd.Parameters.Add(new NpgsqlParameter("sections_json", NpgsqlDbType.Jsonb)
            {
                Value = JsonSerializer.Serialize(payload)
            });
        }, transaction, cancellationToken);

    public Task ReplaceBriefingSourcesAsync(Guid briefingId, IReadOnlyList<ResearchBriefingSourceInput> sources, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/ReplaceResearchBriefingSources.sql", cmd =>
        {
            var payload = sources.Select((source, index) => new
            {
                sourceOrder = index,
                title = source.Title,
                domain = source.Domain
            }).ToArray();
            cmd.Parameters.AddWithValue("briefing_id", briefingId);
            cmd.Parameters.Add(new NpgsqlParameter("sources_json", NpgsqlDbType.Jsonb)
            {
                Value = JsonSerializer.Serialize(payload)
            });
        }, transaction, cancellationToken);

    public Task UpdateTopicBriefingStateAsync(Guid topicId, DateTimeOffset? lastRunAt, DateTimeOffset? nextRunAt, string? lastBriefingPreview, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/UpdateResearchTopicBriefingState.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.AddWithValue("last_run_at", (object?)lastRunAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("next_run_at", (object?)nextRunAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("last_briefing_preview", (object?)lastBriefingPreview ?? DBNull.Value);
            cmd.Parameters.AddWithValue("updated_at", DateTimeOffset.UtcNow.UtcDateTime);
        }, transaction, cancellationToken);

    private async Task<T?> QuerySingleOrDefaultAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (_transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, _transaction);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? mapper(reader) : default;
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transientCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(transientCommand);
        await using var transientReader = await transientCommand.ExecuteReaderAsync(cancellationToken);
        return await transientReader.ReadAsync(cancellationToken) ? mapper(transientReader) : default;
    }

    private async Task<IReadOnlyList<T>> QueryManyAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (_transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, _transaction);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var items = new List<T>();
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(mapper(reader));
            }

            return items;
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transientCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(transientCommand);
        await using var transientReader = await transientCommand.ExecuteReaderAsync(cancellationToken);
        var transientItems = new List<T>();
        while (await transientReader.ReadAsync(cancellationToken))
        {
            transientItems.Add(mapper(transientReader));
        }

        return transientItems;
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        var item = await QuerySingleOrDefaultAsync(sqlPath, configure, cancellationToken, mapper);
        return item ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, (NpgsqlTransaction)transaction);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new InvalidOperationException($"No rows returned for {sqlPath}.");
            }

            return mapper(reader);
        }

        if (_transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, _transaction);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new InvalidOperationException($"No rows returned for {sqlPath}.");
            }

            return mapper(reader);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transientCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(transientCommand);
        await using var transientReader = await transientCommand.ExecuteReaderAsync(cancellationToken);
        if (!await transientReader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException($"No rows returned for {sqlPath}.");
        }

        return mapper(transientReader);
    }

    private async Task ExecuteNonQueryAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, (NpgsqlTransaction)transaction);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        if (_transaction is not null)
        {
            await using var command = CreateCommand(sqlPath, _transaction);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transientCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(transientCommand);
        await transientCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private NpgsqlCommand CreateCommand(string sqlPath, NpgsqlTransaction transaction)
    {
        var connection = transaction.Connection ?? throw new InvalidOperationException("Transaction is not associated with a connection.");
        return new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection, transaction);
    }

    private static void BindTopic(NpgsqlCommand command, ResearchTopicRecord topic)
    {
        command.Parameters.AddWithValue("id", topic.Id);
        command.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)topic.RequestedByUserId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("name", topic.Name);
        command.Parameters.AddWithValue("description", (object?)topic.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("frequency", topic.Frequency);
        command.Parameters.AddWithValue("status", topic.Status);
        command.Parameters.Add(new NpgsqlParameter("delivery_time", NpgsqlDbType.Time)
        {
            Value = (object?)topic.DeliveryTime?.ToTimeSpan() ?? DBNull.Value
        });
        command.Parameters.AddWithValue("last_run_at", (object?)topic.LastRunAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("next_run_at", (object?)topic.NextRunAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("last_briefing_preview", (object?)topic.LastBriefingPreview ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", topic.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", topic.UpdatedAt.UtcDateTime);
    }

    private static void BindBriefing(NpgsqlCommand command, ResearchBriefingRecord briefing)
    {
        command.Parameters.AddWithValue("id", briefing.Id);
        command.Parameters.AddWithValue("research_topic_id", briefing.ResearchTopicId);
        command.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)briefing.RequestedByUserId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("briefing_version", briefing.BriefingVersion);
        command.Parameters.AddWithValue("generated_at", briefing.GeneratedAt.UtcDateTime);
        command.Parameters.AddWithValue("period_label", briefing.PeriodLabel);
        command.Parameters.AddWithValue("read_time_minutes", briefing.ReadTimeMinutes);
        command.Parameters.AddWithValue("word_count", briefing.WordCount);
        command.Parameters.AddWithValue("summary", briefing.Summary);
        command.Parameters.AddWithValue("preview_text", briefing.PreviewText);
        command.Parameters.AddWithValue("created_at", briefing.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", briefing.UpdatedAt.UtcDateTime);
    }

    private static ResearchTopicDto MapTopic(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            reader.GetString(reader.GetOrdinal("name")),
            reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            reader.GetString(reader.GetOrdinal("frequency")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("delivery_time")) ? null : TimeOnly.FromTimeSpan(reader.GetFieldValue<TimeSpan>(reader.GetOrdinal("delivery_time"))),
            ReadStringArray(reader, "sources"),
            ReadStringArray(reader, "tags"),
            ReadStringArray(reader, "outputs"),
            reader.GetInt32(reader.GetOrdinal("briefings_count")),
            reader.IsDBNull(reader.GetOrdinal("last_run_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_run_at")),
            reader.IsDBNull(reader.GetOrdinal("next_run_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("next_run_at")),
            reader.IsDBNull(reader.GetOrdinal("last_briefing_preview")) ? null : reader.GetString(reader.GetOrdinal("last_briefing_preview")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchBriefingDto MapBriefing(NpgsqlDataReader reader)
    {
        var sections = ReadJsonArray(reader, "sections_json").Select(section => new ResearchBriefingSectionDto(
            section.GetProperty("title").GetString() ?? string.Empty,
            section.GetProperty("sentiment").GetString() ?? "neutral",
            section.GetProperty("items").EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToArray()
        )).ToArray();

        var sources = ReadJsonArray(reader, "sources_json").Select(source => new ResearchBriefingSourceDto(
            source.GetProperty("title").GetString() ?? string.Empty,
            source.GetProperty("domain").GetString() ?? string.Empty
        )).ToArray();

        var pastBriefings = ReadJsonArray(reader, "past_briefings_json").Select(item => new ResearchBriefingHistoryItemDto(
            item.GetProperty("id").GetGuid(),
            item.GetProperty("generated_at").GetDateTimeOffset(),
            item.GetProperty("preview_text").GetString() ?? string.Empty
        )).ToArray();

        return new ResearchBriefingDto(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            reader.GetString(reader.GetOrdinal("topic_name")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("generated_at")),
            reader.GetString(reader.GetOrdinal("period_label")),
            reader.GetInt32(reader.GetOrdinal("read_time_minutes")),
            reader.GetInt32(reader.GetOrdinal("word_count")),
            reader.GetString(reader.GetOrdinal("summary")),
            sections,
            sources,
            pastBriefings,
            reader.GetString(reader.GetOrdinal("preview_text")));
    }

    private static string[] ReadStringArray(NpgsqlDataReader reader, string column)
        => reader.IsDBNull(reader.GetOrdinal(column))
            ? Array.Empty<string>()
            : reader.GetFieldValue<string[]>(reader.GetOrdinal(column));

    private static IReadOnlyList<JsonElement> ReadJsonArray(NpgsqlDataReader reader, string column)
    {
        if (reader.IsDBNull(reader.GetOrdinal(column)))
        {
            return Array.Empty<JsonElement>();
        }

        var raw = reader.GetString(reader.GetOrdinal(column));
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<JsonElement>();
        }

        using var document = JsonDocument.Parse(raw);
        var elements = document.RootElement.EnumerateArray()
            .Select(item => item.Clone())
            .ToArray();

        return elements;
    }
}
