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

    public Task<IReadOnlyList<ResearchTopicDto>> ListDueActiveTopicsAsync(DateTimeOffset dueAt, int limit, CancellationToken cancellationToken)
        => QueryManyAsync("Research/ListDueActiveResearchTopics.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("due_at", dueAt.UtcDateTime);
            cmd.Parameters.AddWithValue("limit_value", limit);
        }, cancellationToken, MapTopic);

    public Task<bool> HasActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/HasActiveResearchTopicRun.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, reader => reader.GetBoolean(reader.GetOrdinal("has_active_run")));

    public Task<ResearchActiveTopicRunDto?> GetActiveTopicRunAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Research/GetActiveResearchTopicRun.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, reader => new ResearchActiveTopicRunDto(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.IsDBNull(reader.GetOrdinal("job_id")) ? null : reader.GetGuid(reader.GetOrdinal("job_id")),
            reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at"))));

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

    public Task UpdateTopicNextRunAtAsync(Guid topicId, DateTimeOffset? nextRunAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Research/UpdateResearchTopicNextRunAt.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.AddWithValue("next_run_at", (object?)nextRunAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("updated_at", DateTimeOffset.UtcNow.UtcDateTime);
        }, transaction, cancellationToken);

    public Task<ResearchSearchPlanRecord?> GetSearchPlanByTopicIdAsync(Guid topicId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Research/GetResearchTopicSearchPlanByTopicId.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, MapSearchPlan);

    public Task<Guid> UpsertSearchPlanAsync(ResearchSearchPlanRecord plan, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Research/UpsertResearchTopicSearchPlan.sql", cmd =>
        {
            BindSearchPlan(cmd, plan);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

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

    public Task<Guid> CreateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRuns/CreateResearchTopicRun.sql", cmd =>
        {
            BindTopicRun(cmd, run);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateTopicRunAsync(ResearchTopicRunRecord run, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchRuns/UpdateResearchTopicRun.sql", cmd =>
        {
            BindTopicRun(cmd, run);
        }, transaction, cancellationToken);

    public async Task<bool> CancelTopicRunByWorkflowIdAsync(Guid workflowId, string reason, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow.UtcDateTime;
        void Configure(NpgsqlCommand cmd)
        {
            cmd.Parameters.AddWithValue("workflow_id", workflowId);
            cmd.Parameters.AddWithValue("reason", reason);
            cmd.Parameters.AddWithValue("finished_at", now);
            cmd.Parameters.AddWithValue("updated_at", now);
        }

        if (transaction is not null)
        {
            await using var command = CreateCommand("ResearchRuns/CancelResearchTopicRunByWorkflowId.sql", (NpgsqlTransaction)transaction);
            Configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken);
        }

        if (_transaction is not null)
        {
            await using var command = CreateCommand("ResearchRuns/CancelResearchTopicRunByWorkflowId.sql", _transaction);
            Configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken);
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transientCommand = new NpgsqlCommand(sqlScriptLoader.Load("ResearchRuns/CancelResearchTopicRunByWorkflowId.sql"), connection);
        Configure(transientCommand);
        await using var transientReader = await transientCommand.ExecuteReaderAsync(cancellationToken);
        return await transientReader.ReadAsync(cancellationToken);
    }

    public Task<ResearchTopicRunDto?> GetTopicRunByIdAsync(Guid runId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("ResearchRuns/GetResearchTopicRunById.sql", cmd => cmd.Parameters.AddWithValue("run_id", runId), cancellationToken, MapTopicRun);

    public Task<IReadOnlyList<ResearchTopicRunDto>> ListTopicRunsAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchRuns/ListResearchTopicRuns.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("topic_id", topicId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapTopicRun);

    public Task<IReadOnlyList<ResearchTopicRunDto>> ListActiveTopicRunJobsAsync(Guid topicId, CancellationToken cancellationToken)
        => QueryManyAsync("Research/ListActiveResearchTopicRunJobs.sql", cmd => cmd.Parameters.AddWithValue("topic_id", topicId), cancellationToken, MapTopicRun);

    public Task<Guid> CreateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRuns/CreateResearchTopicRunPhase.sql", cmd =>
        {
            BindTopicRunPhase(cmd, phase);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateTopicRunPhaseAsync(ResearchTopicRunPhaseRecord phase, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchRuns/UpdateResearchTopicRunPhase.sql", cmd =>
        {
            BindTopicRunPhase(cmd, phase);
        }, transaction, cancellationToken);

    public Task<ResearchTopicRunPhaseDto?> GetTopicRunPhaseAsync(Guid runId, string phaseKey, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("ResearchRuns/GetResearchTopicRunPhase.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("run_id", runId);
            cmd.Parameters.AddWithValue("phase_key", phaseKey);
        }, cancellationToken, MapTopicRunPhase);

    public Task<IReadOnlyList<ResearchTopicRunPhaseDto>> ListTopicRunPhasesAsync(Guid runId, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchRuns/ListResearchTopicRunPhases.sql", cmd => cmd.Parameters.AddWithValue("run_id", runId), cancellationToken, MapTopicRunPhase);

    public Task<Guid> CreateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRuns/CreateResearchSearchRun.sql", cmd =>
        {
            BindSearchRun(cmd, searchRun);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateSearchRunAsync(ResearchSearchRunRecord searchRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchRuns/UpdateResearchSearchRun.sql", cmd =>
        {
            BindSearchRun(cmd, searchRun);
        }, transaction, cancellationToken);

    public Task<Guid> CreateSearchResultAsync(ResearchSearchResultRecord result, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRuns/CreateResearchSearchResult.sql", cmd =>
        {
            BindSearchResult(cmd, result);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<IReadOnlyList<ResearchSearchResultDto>> ListSearchResultsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchRuns/ListResearchSearchResults.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapSearchResult);

    public Task<Guid> CreateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchContent/CreateResearchContentRun.sql", cmd =>
        {
            BindContentRun(cmd, contentRun);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateContentRunAsync(ResearchContentRunRecord contentRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchContent/UpdateResearchContentRun.sql", cmd =>
        {
            BindContentRun(cmd, contentRun);
        }, transaction, cancellationToken);

    public Task<ResearchContentRunDto?> GetContentRunByIdAsync(Guid contentRunId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("ResearchContent/GetResearchContentRunById.sql", cmd => cmd.Parameters.AddWithValue("content_run_id", contentRunId), cancellationToken, MapContentRun);

    public Task<Guid> CreateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchContent/CreateResearchContentItem.sql", cmd =>
        {
            BindContentItem(cmd, contentItem);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateContentItemAsync(ResearchContentItemRecord contentItem, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchContent/UpdateResearchContentItem.sql", cmd =>
        {
            BindContentItem(cmd, contentItem);
        }, transaction, cancellationToken);

    public Task<IReadOnlyList<ResearchContentItemDto>> ListContentItemsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchContent/ListResearchContentItems.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapContentItem);

    public Task<Guid> CreateDocumentAsync(ResearchDocumentRecord document, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchDocuments/CreateResearchDocument.sql", cmd =>
        {
            BindDocument(cmd, document);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<Guid> CreateDocumentChunkAsync(ResearchDocumentChunkRecord chunk, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchDocuments/CreateResearchDocumentChunk.sql", cmd =>
        {
            BindDocumentChunk(cmd, chunk);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<IReadOnlyList<ResearchDocumentDto>> ListDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchDocuments/ListResearchDocuments.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapDocument);

    public Task<IReadOnlyList<ResearchDocumentChunkDto>> ListDocumentChunksAsync(Guid researchDocumentId, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchDocuments/ListResearchDocumentChunks.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_document_id", researchDocumentId);
        }, cancellationToken, MapDocumentChunk);

    public Task<Guid> CreateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRankings/CreateResearchRankingRun.sql", cmd =>
        {
            BindRankingRun(cmd, rankingRun);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateRankingRunAsync(ResearchRankingRunRecord rankingRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchRankings/UpdateResearchRankingRun.sql", cmd =>
        {
            BindRankingRun(cmd, rankingRun);
        }, transaction, cancellationToken);

    public Task<ResearchRankingRunDto?> GetRankingRunByIdAsync(Guid rankingRunId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("ResearchRankings/GetResearchRankingRunById.sql", cmd => cmd.Parameters.AddWithValue("ranking_run_id", rankingRunId), cancellationToken, MapRankingRun);

    public Task<IReadOnlyList<ResearchRankingRunDto>> ListRankingRunsAsync(Guid researchTopicRunId, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchRankings/ListResearchRankingRuns.sql", cmd => cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId), cancellationToken, MapRankingRun);

    public Task<Guid> CreateRankedDocumentAsync(ResearchRankedDocumentRecord rankedDocument, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchRankings/CreateResearchRankedDocument.sql", cmd =>
        {
            BindRankedDocument(cmd, rankedDocument);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task<IReadOnlyList<ResearchRankedDocumentDto>> ListRankedDocumentsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchRankings/ListResearchRankedDocuments.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapRankedDocument);

    public Task<Guid> CreateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("ResearchSynthesis/CreateResearchSynthesisRun.sql", cmd =>
        {
            BindSynthesisRun(cmd, synthesisRun);
        }, transaction, cancellationToken, reader => reader.GetGuid(reader.GetOrdinal("id")));

    public Task UpdateSynthesisRunAsync(ResearchSynthesisRunRecord synthesisRun, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("ResearchSynthesis/UpdateResearchSynthesisRun.sql", cmd =>
        {
            BindSynthesisRun(cmd, synthesisRun);
        }, transaction, cancellationToken);

    public Task<ResearchSynthesisRunDto?> GetSynthesisRunByIdAsync(Guid synthesisRunId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("ResearchSynthesis/GetResearchSynthesisRunById.sql", cmd => cmd.Parameters.AddWithValue("synthesis_run_id", synthesisRunId), cancellationToken, MapSynthesisRun);

    public Task<IReadOnlyList<ResearchSynthesisRunDto>> ListSynthesisRunsAsync(Guid researchTopicRunId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("ResearchSynthesis/ListResearchSynthesisRuns.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("research_topic_run_id", researchTopicRunId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapSynthesisRun);

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

    private static void BindTopicRun(NpgsqlCommand command, ResearchTopicRunRecord run)
    {
        command.Parameters.AddWithValue("id", run.Id);
        command.Parameters.AddWithValue("research_topic_id", run.ResearchTopicId);
        command.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)run.RequestedByUserId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("job_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)run.JobId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("workflow_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)run.WorkflowId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("status", run.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("triggered_by", (object?)run.TriggeredBy ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", (object?)run.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)run.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("next_retry_at", (object?)run.NextRetryAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)run.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)run.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("summary_preview", (object?)run.SummaryPreview ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", run.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", run.UpdatedAt.UtcDateTime);
    }

    private static void BindTopicRunPhase(NpgsqlCommand command, ResearchTopicRunPhaseRecord phase)
    {
        command.Parameters.AddWithValue("id", phase.Id);
        command.Parameters.AddWithValue("research_topic_run_id", phase.ResearchTopicRunId);
        command.Parameters.AddWithValue("phase_key", phase.PhaseKey);
        command.Parameters.AddWithValue("status", phase.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("attempt_count", phase.AttemptCount);
        command.Parameters.AddWithValue("started_at", (object?)phase.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)phase.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)phase.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)phase.ErrorMessage ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metrics_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(phase.MetricsJson) ? "{}" : phase.MetricsJson
        });
        command.Parameters.AddWithValue("created_at", phase.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", phase.UpdatedAt.UtcDateTime);
    }

    private static void BindSearchRun(NpgsqlCommand command, ResearchSearchRunRecord searchRun)
    {
        command.Parameters.AddWithValue("id", searchRun.Id);
        command.Parameters.AddWithValue("research_topic_run_id", searchRun.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_run_phase_id", searchRun.ResearchTopicRunPhaseId);
        command.Parameters.AddWithValue("research_topic_id", searchRun.ResearchTopicId);
        command.Parameters.AddWithValue("source_key", searchRun.SourceKey);
        command.Parameters.AddWithValue("planner_version", searchRun.PlannerVersion);
        command.Parameters.AddWithValue("query_count", searchRun.QueryCount);
        command.Parameters.AddWithValue("status", searchRun.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("started_at", (object?)searchRun.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)searchRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)searchRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)searchRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metrics_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(searchRun.MetricsJson) ? "{}" : searchRun.MetricsJson
        });
        command.Parameters.AddWithValue("created_at", searchRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", searchRun.UpdatedAt.UtcDateTime);
    }

    private static void BindSearchResult(NpgsqlCommand command, ResearchSearchResultRecord result)
    {
        command.Parameters.AddWithValue("id", result.Id);
        command.Parameters.AddWithValue("research_search_run_id", result.ResearchSearchRunId);
        command.Parameters.AddWithValue("research_topic_run_id", result.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_id", result.ResearchTopicId);
        command.Parameters.AddWithValue("source_key", result.SourceKey);
        command.Parameters.AddWithValue("query", result.Query);
        command.Parameters.AddWithValue("title", result.Title);
        command.Parameters.AddWithValue("url", result.Url);
        command.Parameters.AddWithValue("canonical_url", (object?)result.CanonicalUrl ?? DBNull.Value);
        command.Parameters.AddWithValue("snippet", (object?)result.Snippet ?? DBNull.Value);
        command.Parameters.AddWithValue("score", result.Score);
        command.Parameters.AddWithValue("published_at", (object?)result.PublishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("author_name", (object?)result.AuthorName ?? DBNull.Value);
        command.Parameters.AddWithValue("domain", (object?)result.Domain ?? DBNull.Value);
        command.Parameters.AddWithValue("language", (object?)result.Language ?? DBNull.Value);
        command.Parameters.AddWithValue("result_rank", result.ResultRank);
        command.Parameters.Add(new NpgsqlParameter("raw_result_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(result.RawResultJson) ? "{}" : result.RawResultJson
        });
        command.Parameters.AddWithValue("created_at", result.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", result.UpdatedAt.UtcDateTime);
    }

    private static void BindContentRun(NpgsqlCommand command, ResearchContentRunRecord contentRun)
    {
        command.Parameters.AddWithValue("id", contentRun.Id);
        command.Parameters.AddWithValue("research_topic_run_id", contentRun.ResearchTopicRunId);
        command.Parameters.Add(new NpgsqlParameter("research_topic_run_phase_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)contentRun.ResearchTopicRunPhaseId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("research_topic_id", contentRun.ResearchTopicId);
        command.Parameters.AddWithValue("status", contentRun.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("started_at", (object?)contentRun.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)contentRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)contentRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)contentRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metrics_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(contentRun.MetricsJson) ? "{}" : contentRun.MetricsJson
        });
        command.Parameters.AddWithValue("created_at", contentRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", contentRun.UpdatedAt.UtcDateTime);
    }

    private static void BindContentItem(NpgsqlCommand command, ResearchContentItemRecord contentItem)
    {
        command.Parameters.AddWithValue("id", contentItem.Id);
        command.Parameters.AddWithValue("research_content_run_id", contentItem.ResearchContentRunId);
        command.Parameters.AddWithValue("research_topic_run_id", contentItem.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_id", contentItem.ResearchTopicId);
        command.Parameters.AddWithValue("source_key", contentItem.SourceKey);
        command.Parameters.AddWithValue("source_url", contentItem.SourceUrl);
        command.Parameters.AddWithValue("canonical_url", (object?)contentItem.CanonicalUrl ?? DBNull.Value);
        command.Parameters.AddWithValue("title", contentItem.Title);
        command.Parameters.AddWithValue("author_name", (object?)contentItem.AuthorName ?? DBNull.Value);
        command.Parameters.AddWithValue("published_at", (object?)contentItem.PublishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("fetch_method", contentItem.FetchMethod);
        command.Parameters.AddWithValue("content_type", contentItem.ContentType);
        command.Parameters.AddWithValue("status", contentItem.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("content_hash", (object?)contentItem.ContentHash ?? DBNull.Value);
        command.Parameters.AddWithValue("raw_text", (object?)contentItem.RawText ?? DBNull.Value);
        command.Parameters.AddWithValue("raw_storage_path", (object?)contentItem.RawStoragePath ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("raw_metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(contentItem.RawMetadataJson) ? "{}" : contentItem.RawMetadataJson
        });
        command.Parameters.AddWithValue("error_code", (object?)contentItem.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)contentItem.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", contentItem.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", contentItem.UpdatedAt.UtcDateTime);
    }

    private static void BindDocument(NpgsqlCommand command, ResearchDocumentRecord document)
    {
        command.Parameters.AddWithValue("id", document.Id);
        command.Parameters.AddWithValue("research_content_item_id", document.ResearchContentItemId);
        command.Parameters.AddWithValue("research_topic_run_id", document.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_id", document.ResearchTopicId);
        command.Parameters.AddWithValue("source_key", document.SourceKey);
        command.Parameters.AddWithValue("canonical_url", document.CanonicalUrl);
        command.Parameters.AddWithValue("title", document.Title);
        command.Parameters.AddWithValue("author_name", (object?)document.AuthorName ?? DBNull.Value);
        command.Parameters.AddWithValue("published_at", (object?)document.PublishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("normalized_at", document.NormalizedAt.UtcDateTime);
        command.Parameters.AddWithValue("canonical_body", document.CanonicalBody);
        command.Parameters.AddWithValue("canonical_hash", document.CanonicalHash);
        command.Parameters.AddWithValue("raw_content_hash", document.RawContentHash);
        command.Parameters.Add(new NpgsqlParameter("source_provenance_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(document.SourceProvenanceJson) ? "{}" : document.SourceProvenanceJson
        });
        command.Parameters.AddWithValue("normalizer_version", document.NormalizerVersion);
        command.Parameters.AddWithValue("created_at", document.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", document.UpdatedAt.UtcDateTime);
    }

    private static void BindDocumentChunk(NpgsqlCommand command, ResearchDocumentChunkRecord chunk)
    {
        command.Parameters.AddWithValue("id", chunk.Id);
        command.Parameters.AddWithValue("research_document_id", chunk.ResearchDocumentId);
        command.Parameters.AddWithValue("chunk_index", chunk.ChunkIndex);
        command.Parameters.AddWithValue("chunk_title", (object?)chunk.ChunkTitle ?? DBNull.Value);
        command.Parameters.AddWithValue("chunk_text", chunk.ChunkText);
        command.Parameters.AddWithValue("token_count", chunk.TokenCount);
        command.Parameters.AddWithValue("start_offset", chunk.StartOffset);
        command.Parameters.AddWithValue("end_offset", chunk.EndOffset);
        command.Parameters.AddWithValue("chunk_hash", chunk.ChunkHash);
        command.Parameters.Add(new NpgsqlParameter("chunk_metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(chunk.ChunkMetadataJson) ? "{}" : chunk.ChunkMetadataJson
        });
        command.Parameters.AddWithValue("created_at", chunk.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", chunk.UpdatedAt.UtcDateTime);
    }

    private static void BindRankingRun(NpgsqlCommand command, ResearchRankingRunRecord rankingRun)
    {
        command.Parameters.AddWithValue("id", rankingRun.Id);
        command.Parameters.AddWithValue("research_topic_run_id", rankingRun.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_run_phase_id", rankingRun.ResearchTopicRunPhaseId);
        command.Parameters.AddWithValue("research_topic_id", rankingRun.ResearchTopicId);
        command.Parameters.AddWithValue("status", rankingRun.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("scoring_version", rankingRun.ScoringVersion);
        command.Parameters.AddWithValue("total_documents", rankingRun.TotalDocuments);
        command.Parameters.AddWithValue("selected_documents", rankingRun.SelectedDocuments);
        command.Parameters.AddWithValue("started_at", (object?)rankingRun.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)rankingRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)rankingRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)rankingRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metrics_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(rankingRun.MetricsJson) ? "{}" : rankingRun.MetricsJson
        });
        command.Parameters.AddWithValue("created_at", rankingRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", rankingRun.UpdatedAt.UtcDateTime);
    }

    private static void BindRankedDocument(NpgsqlCommand command, ResearchRankedDocumentRecord rankedDocument)
    {
        command.Parameters.AddWithValue("id", rankedDocument.Id);
        command.Parameters.AddWithValue("research_ranking_run_id", rankedDocument.ResearchRankingRunId);
        command.Parameters.AddWithValue("research_topic_run_id", rankedDocument.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_id", rankedDocument.ResearchTopicId);
        command.Parameters.AddWithValue("research_document_id", rankedDocument.ResearchDocumentId);
        command.Parameters.AddWithValue("source_key", rankedDocument.SourceKey);
        command.Parameters.AddWithValue("title", rankedDocument.Title);
        command.Parameters.AddWithValue("canonical_url", rankedDocument.CanonicalUrl);
        command.Parameters.AddWithValue("score", rankedDocument.Score);
        command.Parameters.AddWithValue("freshness_score", rankedDocument.FreshnessScore);
        command.Parameters.AddWithValue("source_weight", rankedDocument.SourceWeight);
        command.Parameters.AddWithValue("length_score", rankedDocument.LengthScore);
        command.Parameters.AddWithValue("rank_position", rankedDocument.RankPosition);
        command.Parameters.AddWithValue("is_selected", rankedDocument.IsSelected);
        command.Parameters.Add(new NpgsqlParameter("reason_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(rankedDocument.ReasonJson) ? "{}" : rankedDocument.ReasonJson
        });
        command.Parameters.AddWithValue("created_at", rankedDocument.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", rankedDocument.UpdatedAt.UtcDateTime);
    }

    private static void BindSynthesisRun(NpgsqlCommand command, ResearchSynthesisRunRecord synthesisRun)
    {
        command.Parameters.AddWithValue("id", synthesisRun.Id);
        command.Parameters.AddWithValue("research_topic_run_id", synthesisRun.ResearchTopicRunId);
        command.Parameters.AddWithValue("research_topic_run_phase_id", synthesisRun.ResearchTopicRunPhaseId);
        command.Parameters.AddWithValue("research_topic_id", synthesisRun.ResearchTopicId);
        command.Parameters.AddWithValue("research_ranking_run_id", synthesisRun.ResearchRankingRunId);
        command.Parameters.AddWithValue("status", synthesisRun.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("reasoning_provider", synthesisRun.ReasoningProvider);
        command.Parameters.AddWithValue("model", synthesisRun.Model);
        command.Parameters.AddWithValue("prompt_version", synthesisRun.PromptVersion);
        command.Parameters.AddWithValue("input_hash", synthesisRun.InputHash);
        command.Parameters.Add(new NpgsqlParameter("request_json", NpgsqlDbType.Jsonb)
        {
            Value = (object?)synthesisRun.RequestJson ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("response_json", NpgsqlDbType.Jsonb)
        {
            Value = (object?)synthesisRun.ResponseJson ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("output_json", NpgsqlDbType.Jsonb)
        {
            Value = (object?)synthesisRun.OutputJson ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("usage_json", NpgsqlDbType.Jsonb)
        {
            Value = (object?)synthesisRun.UsageJson ?? DBNull.Value
        });
        command.Parameters.AddWithValue("selected_document_count", synthesisRun.SelectedDocumentCount);
        command.Parameters.AddWithValue("started_at", (object?)synthesisRun.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)synthesisRun.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)synthesisRun.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)synthesisRun.ErrorMessage ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("research_briefing_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)synthesisRun.ResearchBriefingId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("created_at", synthesisRun.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", synthesisRun.UpdatedAt.UtcDateTime);
    }

    private static void BindTopic(NpgsqlCommand command, ResearchTopicRecord topic)
    {
        command.Parameters.AddWithValue("id", topic.Id);
        command.Parameters.Add(new NpgsqlParameter("requested_by_user_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)topic.RequestedByUserId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("project_id", NpgsqlDbType.Uuid)
        {
            Value = (object?)topic.ProjectId ?? DBNull.Value
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

    private static void BindSearchPlan(NpgsqlCommand command, ResearchSearchPlanRecord plan)
    {
        command.Parameters.AddWithValue("id", plan.Id);
        command.Parameters.AddWithValue("research_topic_id", plan.ResearchTopicId);
        command.Parameters.AddWithValue("plan_version", plan.PlanVersion);
        command.Parameters.AddWithValue("prompt_key", plan.PromptKey);
        command.Parameters.AddWithValue("prompt_version", plan.PromptVersion);
        command.Parameters.AddWithValue("provider", plan.Provider);
        command.Parameters.AddWithValue("model", plan.Model);
        command.Parameters.AddWithValue("status", plan.Status.ToString().ToLowerInvariant());
        command.Parameters.Add(new NpgsqlParameter("plan_json", NpgsqlDbType.Jsonb)
        {
            Value = string.IsNullOrWhiteSpace(plan.PlanJson) ? DBNull.Value : plan.PlanJson
        });
        command.Parameters.AddWithValue("input_hash", plan.InputHash);
        command.Parameters.AddWithValue("source_hash", (object?)plan.SourceHash ?? DBNull.Value);
        command.Parameters.AddWithValue("generated_at", (object?)plan.GeneratedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)plan.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)plan.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", plan.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", plan.UpdatedAt.UtcDateTime);
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
            reader.IsDBNull(reader.GetOrdinal("project_id")) ? null : reader.GetGuid(reader.GetOrdinal("project_id")),
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

    private static ResearchTopicRunDto MapTopicRun(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            reader.IsDBNull(reader.GetOrdinal("job_id")) ? null : reader.GetGuid(reader.GetOrdinal("job_id")),
            reader.IsDBNull(reader.GetOrdinal("workflow_id")) ? null : reader.GetGuid(reader.GetOrdinal("workflow_id")),
            Enum.Parse<ResearchTopicRunStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.IsDBNull(reader.GetOrdinal("triggered_by")) ? null : reader.GetString(reader.GetOrdinal("triggered_by")),
            reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            reader.IsDBNull(reader.GetOrdinal("next_retry_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("next_retry_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.IsDBNull(reader.GetOrdinal("summary_preview")) ? null : reader.GetString(reader.GetOrdinal("summary_preview")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchTopicRunPhaseDto MapTopicRunPhase(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetString(reader.GetOrdinal("phase_key")),
            Enum.Parse<ResearchTopicRunPhaseStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.GetInt32(reader.GetOrdinal("attempt_count")),
            reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.IsDBNull(reader.GetOrdinal("metrics_json")) ? null : reader.GetString(reader.GetOrdinal("metrics_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchSearchPlanRecord MapSearchPlan(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetInt32(reader.GetOrdinal("plan_version")),
            reader.GetString(reader.GetOrdinal("prompt_key")),
            reader.GetString(reader.GetOrdinal("prompt_version")),
            reader.GetString(reader.GetOrdinal("provider")),
            reader.GetString(reader.GetOrdinal("model")),
            Enum.Parse<ResearchSearchPlanStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.IsDBNull(reader.GetOrdinal("plan_json")) ? null : reader.GetString(reader.GetOrdinal("plan_json")),
            reader.GetString(reader.GetOrdinal("input_hash")),
            reader.IsDBNull(reader.GetOrdinal("source_hash")) ? null : reader.GetString(reader.GetOrdinal("source_hash")),
            reader.IsDBNull(reader.GetOrdinal("generated_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("generated_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchSearchResultDto MapSearchResult(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_search_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetString(reader.GetOrdinal("source_key")),
            reader.GetString(reader.GetOrdinal("query")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("url")),
            reader.IsDBNull(reader.GetOrdinal("canonical_url")) ? null : reader.GetString(reader.GetOrdinal("canonical_url")),
            reader.IsDBNull(reader.GetOrdinal("snippet")) ? null : reader.GetString(reader.GetOrdinal("snippet")),
            reader.GetFieldValue<double>(reader.GetOrdinal("score")),
            reader.IsDBNull(reader.GetOrdinal("published_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("published_at")),
            reader.IsDBNull(reader.GetOrdinal("author_name")) ? null : reader.GetString(reader.GetOrdinal("author_name")),
            reader.IsDBNull(reader.GetOrdinal("domain")) ? null : reader.GetString(reader.GetOrdinal("domain")),
            reader.IsDBNull(reader.GetOrdinal("language")) ? null : reader.GetString(reader.GetOrdinal("language")),
            reader.GetInt32(reader.GetOrdinal("result_rank")),
            reader.GetString(reader.GetOrdinal("raw_result_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchContentRunDto MapContentRun(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.IsDBNull(reader.GetOrdinal("research_topic_run_phase_id")) ? null : reader.GetGuid(reader.GetOrdinal("research_topic_run_phase_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            Enum.Parse<ResearchContentRunStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.IsDBNull(reader.GetOrdinal("metrics_json")) ? null : reader.GetString(reader.GetOrdinal("metrics_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchContentItemDto MapContentItem(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_content_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetString(reader.GetOrdinal("source_key")),
            reader.GetString(reader.GetOrdinal("source_url")),
            reader.IsDBNull(reader.GetOrdinal("canonical_url")) ? null : reader.GetString(reader.GetOrdinal("canonical_url")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.IsDBNull(reader.GetOrdinal("author_name")) ? null : reader.GetString(reader.GetOrdinal("author_name")),
            reader.IsDBNull(reader.GetOrdinal("published_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("published_at")),
            reader.GetString(reader.GetOrdinal("fetch_method")),
            reader.GetString(reader.GetOrdinal("content_type")),
            Enum.Parse<ResearchContentItemStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.IsDBNull(reader.GetOrdinal("content_hash")) ? null : reader.GetString(reader.GetOrdinal("content_hash")),
            reader.IsDBNull(reader.GetOrdinal("raw_text")) ? null : reader.GetString(reader.GetOrdinal("raw_text")),
            reader.IsDBNull(reader.GetOrdinal("raw_storage_path")) ? null : reader.GetString(reader.GetOrdinal("raw_storage_path")),
            reader.IsDBNull(reader.GetOrdinal("raw_metadata_json")) ? null : reader.GetString(reader.GetOrdinal("raw_metadata_json")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchDocumentDto MapDocument(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_content_item_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetString(reader.GetOrdinal("source_key")),
            reader.GetString(reader.GetOrdinal("canonical_url")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.IsDBNull(reader.GetOrdinal("author_name")) ? null : reader.GetString(reader.GetOrdinal("author_name")),
            reader.IsDBNull(reader.GetOrdinal("published_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("published_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("normalized_at")),
            reader.GetString(reader.GetOrdinal("canonical_body")),
            reader.GetString(reader.GetOrdinal("canonical_hash")),
            reader.GetString(reader.GetOrdinal("raw_content_hash")),
            reader.GetString(reader.GetOrdinal("source_provenance_json")),
            reader.GetString(reader.GetOrdinal("normalizer_version")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchDocumentChunkDto MapDocumentChunk(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_document_id")),
            reader.GetInt32(reader.GetOrdinal("chunk_index")),
            reader.IsDBNull(reader.GetOrdinal("chunk_title")) ? null : reader.GetString(reader.GetOrdinal("chunk_title")),
            reader.GetString(reader.GetOrdinal("chunk_text")),
            reader.GetInt32(reader.GetOrdinal("token_count")),
            reader.GetInt32(reader.GetOrdinal("start_offset")),
            reader.GetInt32(reader.GetOrdinal("end_offset")),
            reader.GetString(reader.GetOrdinal("chunk_hash")),
            reader.GetString(reader.GetOrdinal("chunk_metadata_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchRankingRunDto MapRankingRun(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_phase_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            Enum.Parse<ResearchRankingRunStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.GetString(reader.GetOrdinal("scoring_version")),
            reader.GetInt32(reader.GetOrdinal("total_documents")),
            reader.GetInt32(reader.GetOrdinal("selected_documents")),
            reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.IsDBNull(reader.GetOrdinal("metrics_json")) ? null : reader.GetString(reader.GetOrdinal("metrics_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchRankedDocumentDto MapRankedDocument(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_ranking_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetGuid(reader.GetOrdinal("research_document_id")),
            reader.GetString(reader.GetOrdinal("source_key")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.GetString(reader.GetOrdinal("canonical_url")),
            reader.GetFieldValue<double>(reader.GetOrdinal("score")),
            reader.GetFieldValue<double>(reader.GetOrdinal("freshness_score")),
            reader.GetFieldValue<double>(reader.GetOrdinal("source_weight")),
            reader.GetFieldValue<double>(reader.GetOrdinal("length_score")),
            reader.GetInt32(reader.GetOrdinal("rank_position")),
            reader.GetBoolean(reader.GetOrdinal("is_selected")),
            reader.GetString(reader.GetOrdinal("reason_json")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static ResearchSynthesisRunDto MapSynthesisRun(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_run_phase_id")),
            reader.GetGuid(reader.GetOrdinal("research_topic_id")),
            reader.GetGuid(reader.GetOrdinal("research_ranking_run_id")),
            Enum.Parse<ResearchSynthesisRunStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            reader.GetString(reader.GetOrdinal("reasoning_provider")),
            reader.GetString(reader.GetOrdinal("model")),
            reader.GetString(reader.GetOrdinal("prompt_version")),
            reader.GetString(reader.GetOrdinal("input_hash")),
            reader.IsDBNull(reader.GetOrdinal("request_json")) ? null : reader.GetString(reader.GetOrdinal("request_json")),
            reader.IsDBNull(reader.GetOrdinal("response_json")) ? null : reader.GetString(reader.GetOrdinal("response_json")),
            reader.IsDBNull(reader.GetOrdinal("output_json")) ? null : reader.GetString(reader.GetOrdinal("output_json")),
            reader.IsDBNull(reader.GetOrdinal("usage_json")) ? null : reader.GetString(reader.GetOrdinal("usage_json")),
            reader.GetInt32(reader.GetOrdinal("selected_document_count")),
            reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            reader.IsDBNull(reader.GetOrdinal("research_briefing_id")) ? null : reader.GetGuid(reader.GetOrdinal("research_briefing_id")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

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
