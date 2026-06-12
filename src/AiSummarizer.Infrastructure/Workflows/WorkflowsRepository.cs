using System.Data.Common;
using System.Text.Json;
using AiSummarizer.Application.Workflows;
using AiSummarizer.Domain.Workflows;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Workflows;

public sealed class WorkflowsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IWorkflowsRepository
{
    public async Task<T> ExecuteInTransactionAsync<T>(Func<IWorkflowsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
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

    public Task<Workflow> CreateWorkflowAsync(Workflow workflow, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Workflows/CreateWorkflow.sql", cmd =>
        {
            BindWorkflow(cmd, workflow);
        }, transaction, cancellationToken, MapWorkflow);

    public Task<Workflow?> GetWorkflowByIdAsync(Guid workflowId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Workflows/GetWorkflowById.sql", cmd => cmd.Parameters.AddWithValue("workflow_id", workflowId), cancellationToken);

    public Task<Workflow?> GetActiveWorkflowBySourceIdAsync(Guid sourceId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Workflows/GetActiveWorkflowBySourceId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_id", sourceId);
        }, cancellationToken);

    public Task<Workflow?> GetActiveWorkflowBySourceIdAndTypeAsync(Guid sourceId, string workflowType, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Workflows/GetActiveWorkflowBySourceIdAndType.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_id", sourceId);
            cmd.Parameters.AddWithValue("workflow_type", workflowType);
        }, cancellationToken);

    public Task<Workflow?> GetActiveWorkflowBySourceUrlAsync(string sourceUrl, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Workflows/GetActiveWorkflowBySourceUrl.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_url", sourceUrl);
        }, cancellationToken);

    public Task<IReadOnlyList<Workflow>> ListInsightWorkflowsBySourceIdAsync(Guid sourceId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Workflows/ListInsightWorkflowsBySourceId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("source_id", sourceId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<IReadOnlyList<Workflow>> ListActiveWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Workflows/ListActiveWorkflows.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<IReadOnlyList<Workflow>> ListHistoryWorkflowsAsync(int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Workflows/ListHistoryWorkflows.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<IReadOnlyList<WorkflowStep>> ListStepsAsync(Guid workflowId, CancellationToken cancellationToken)
        => QueryManyAsync("Workflows/ListWorkflowSteps.sql", cmd => cmd.Parameters.AddWithValue("workflow_id", workflowId), cancellationToken, MapWorkflowStep);

    public Task<IReadOnlyList<WorkflowEvent>> ListEventsAsync(Guid workflowId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Workflows/ListWorkflowEvents.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("workflow_id", workflowId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapWorkflowEvent);

    public Task<Workflow?> ClaimNextWorkflowAsync(string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Workflows/ClaimNextWorkflow.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("lease_seconds", (int)Math.Ceiling(leaseDuration.TotalSeconds));
        }, cancellationToken);

    public Task<bool> HeartbeatWorkflowAsync(Guid workflowId, string workerId, short? progressPercent, string? progressMessage, TimeSpan leaseDuration, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Workflows/HeartbeatWorkflow.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("workflow_id", workflowId);
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("progress_percent", (object?)progressPercent ?? DBNull.Value);
            cmd.Parameters.AddWithValue("progress_message", (object?)progressMessage ?? DBNull.Value);
            cmd.Parameters.AddWithValue("lease_seconds", (int)Math.Ceiling(leaseDuration.TotalSeconds));
        }, cancellationToken);

    public Task<Workflow> UpdateWorkflowAsync(Workflow workflow, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Workflows/UpdateWorkflow.sql", cmd => BindWorkflow(cmd, workflow), transaction, cancellationToken, MapWorkflow);

    public Task<WorkflowStep> CreateWorkflowStepAsync(WorkflowStep step, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Workflows/CreateWorkflowStep.sql", cmd => BindWorkflowStep(cmd, step), transaction, cancellationToken, MapWorkflowStep);

    public Task<WorkflowStep> UpdateWorkflowStepAsync(WorkflowStep step, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Workflows/UpdateWorkflowStep.sql", cmd => BindWorkflowStep(cmd, step), transaction, cancellationToken, MapWorkflowStep);

    public Task<WorkflowEvent> AddWorkflowEventAsync(Guid workflowId, string? stepKey, string level, string message, JsonElement context, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Workflows/AddWorkflowEvent.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("workflow_id", workflowId);
            cmd.Parameters.AddWithValue("step_key", (object?)stepKey ?? DBNull.Value);
            cmd.Parameters.AddWithValue("level", level);
            cmd.Parameters.AddWithValue("message", message);
            cmd.Parameters.Add(new NpgsqlParameter("context_json", NpgsqlDbType.Jsonb)
            {
                Value = context.ValueKind == JsonValueKind.Undefined ? "{}" : context.GetRawText()
            });
        }, transaction, cancellationToken, MapWorkflowEvent);

    private async Task<Workflow?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapWorkflow(reader) : null;
    }

    private async Task<IReadOnlyList<Workflow>> QueryManyAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
        => await QueryManyAsync(sqlPath, configure, cancellationToken, MapWorkflow);

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

    private async Task<bool> ExecuteReturningBoolAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken);
    }

    private static void BindWorkflow(NpgsqlCommand command, Workflow workflow)
    {
        command.Parameters.AddWithValue("id", workflow.Id);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)workflow.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("source_id", (object?)workflow.SourceId ?? DBNull.Value);
        command.Parameters.AddWithValue("workflow_type", workflow.WorkflowType);
        command.Parameters.AddWithValue("status", workflow.Status);
        command.Parameters.Add(new NpgsqlParameter("input_json", NpgsqlDbType.Jsonb)
        {
            Value = workflow.Input.ValueKind == JsonValueKind.Undefined ? "{}" : workflow.Input.GetRawText()
        });
        command.Parameters.Add(new NpgsqlParameter("result_json", NpgsqlDbType.Jsonb)
        {
            Value = workflow.Result is null ? DBNull.Value : workflow.Result.Value.GetRawText()
        });
        command.Parameters.AddWithValue("current_step_key", (object?)workflow.CurrentStepKey ?? DBNull.Value);
        command.Parameters.AddWithValue("error_code", (object?)workflow.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)workflow.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("attempt_count", workflow.AttemptCount);
        command.Parameters.AddWithValue("max_attempts", workflow.MaxAttempts);
        command.Parameters.AddWithValue("available_at", workflow.AvailableAt.UtcDateTime);
        command.Parameters.AddWithValue("locked_by", (object?)workflow.LockedBy ?? DBNull.Value);
        command.Parameters.AddWithValue("locked_at", (object?)workflow.LockedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("locked_until", (object?)workflow.LockedUntil?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", (object?)workflow.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)workflow.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("heartbeat_at", (object?)workflow.HeartbeatAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("progress_percent", (object?)workflow.ProgressPercent ?? DBNull.Value);
        command.Parameters.AddWithValue("progress_message", (object?)workflow.ProgressMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", workflow.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", workflow.UpdatedAt.UtcDateTime);
    }

    private static void BindWorkflowStep(NpgsqlCommand command, WorkflowStep step)
    {
        command.Parameters.AddWithValue("id", step.Id);
        command.Parameters.AddWithValue("workflow_id", step.WorkflowId);
        command.Parameters.AddWithValue("step_order", step.StepOrder);
        command.Parameters.AddWithValue("step_key", step.StepKey);
        command.Parameters.AddWithValue("step_type", step.StepType);
        command.Parameters.AddWithValue("job_id", (object?)step.JobId ?? DBNull.Value);
        command.Parameters.AddWithValue("status", step.Status);
        command.Parameters.Add(new NpgsqlParameter("input_json", NpgsqlDbType.Jsonb)
        {
            Value = step.Input.ValueKind == JsonValueKind.Undefined ? "{}" : step.Input.GetRawText()
        });
        command.Parameters.Add(new NpgsqlParameter("output_json", NpgsqlDbType.Jsonb)
        {
            Value = step.Output is null ? DBNull.Value : step.Output.Value.GetRawText()
        });
        command.Parameters.AddWithValue("error_code", (object?)step.ErrorCode ?? DBNull.Value);
        command.Parameters.AddWithValue("error_message", (object?)step.ErrorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("started_at", (object?)step.StartedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("finished_at", (object?)step.FinishedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", step.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", step.UpdatedAt.UtcDateTime);
    }

    private static Workflow MapWorkflow(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            RequestedByUserId = reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            SourceId = reader.IsDBNull(reader.GetOrdinal("source_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_id")),
            WorkflowType = reader.GetString(reader.GetOrdinal("workflow_type")),
            Status = reader.GetString(reader.GetOrdinal("status")),
            Input = ParseJson(reader.GetString(reader.GetOrdinal("input_json"))),
            Result = reader.IsDBNull(reader.GetOrdinal("result_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("result_json"))),
            CurrentStepKey = reader.IsDBNull(reader.GetOrdinal("current_step_key")) ? null : reader.GetString(reader.GetOrdinal("current_step_key")),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            AttemptCount = reader.GetInt32(reader.GetOrdinal("attempt_count")),
            MaxAttempts = reader.GetInt32(reader.GetOrdinal("max_attempts")),
            AvailableAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("available_at")),
            LockedBy = reader.IsDBNull(reader.GetOrdinal("locked_by")) ? null : reader.GetString(reader.GetOrdinal("locked_by")),
            LockedAt = reader.IsDBNull(reader.GetOrdinal("locked_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("locked_at")),
            LockedUntil = reader.IsDBNull(reader.GetOrdinal("locked_until")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("locked_until")),
            StartedAt = reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            HeartbeatAt = reader.IsDBNull(reader.GetOrdinal("heartbeat_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("heartbeat_at")),
            ProgressPercent = reader.IsDBNull(reader.GetOrdinal("progress_percent")) ? null : reader.GetInt16(reader.GetOrdinal("progress_percent")),
            ProgressMessage = reader.IsDBNull(reader.GetOrdinal("progress_message")) ? null : reader.GetString(reader.GetOrdinal("progress_message")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static WorkflowStep MapWorkflowStep(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            WorkflowId = reader.GetGuid(reader.GetOrdinal("workflow_id")),
            StepOrder = reader.GetInt32(reader.GetOrdinal("step_order")),
            StepKey = reader.GetString(reader.GetOrdinal("step_key")),
            StepType = reader.GetString(reader.GetOrdinal("step_type")),
            JobId = reader.IsDBNull(reader.GetOrdinal("job_id")) ? null : reader.GetGuid(reader.GetOrdinal("job_id")),
            Status = reader.GetString(reader.GetOrdinal("status")),
            Input = ParseJson(reader.GetString(reader.GetOrdinal("input_json"))),
            Output = reader.IsDBNull(reader.GetOrdinal("output_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("output_json"))),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            StartedAt = reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static WorkflowEvent MapWorkflowEvent(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            WorkflowId = reader.GetGuid(reader.GetOrdinal("workflow_id")),
            StepKey = reader.IsDBNull(reader.GetOrdinal("step_key")) ? null : reader.GetString(reader.GetOrdinal("step_key")),
            Level = reader.GetString(reader.GetOrdinal("level")),
            Message = reader.GetString(reader.GetOrdinal("message")),
            Context = ParseJson(reader.GetString(reader.GetOrdinal("context_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at"))
        };

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
