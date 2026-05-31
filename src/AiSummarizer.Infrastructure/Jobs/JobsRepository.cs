using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Domain.Jobs;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Jobs;

public sealed class JobsRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IJobsRepository
{
    public async Task<Job> CreateJobAsync(Job job, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("Jobs/CreateJob.sql"), connection);
        BindCreateJob(command, job);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("Insert did not return a job row.");
        }

        return MapJob(reader);
    }

    public Task<Job?> GetJobByIdAsync(Guid jobId, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Jobs/GetJobById.sql", cmd => cmd.Parameters.AddWithValue("job_id", jobId), cancellationToken);

    public Task<IReadOnlyList<Job>> ListActiveJobsAsync(int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Jobs/ListActiveJobs.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<IReadOnlyList<Job>> ListHistoryJobsAsync(int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Jobs/ListHistoryJobs.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<IReadOnlyList<JobLog>> ListLogsAsync(Guid jobId, int limit, int offset, CancellationToken cancellationToken)
        => QueryLogsAsync("Jobs/ListJobLogs.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken);

    public Task<Job?> ClaimNextJobAsync(string workerId, TimeSpan leaseDuration, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Jobs/ClaimNextJob.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("lease_seconds", (int)Math.Ceiling(leaseDuration.TotalSeconds));
        }, cancellationToken);

    public Task<bool> HeartbeatJobAsync(Guid jobId, string workerId, short? progressPercent, string? progressMessage, TimeSpan leaseDuration, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Jobs/HeartbeatJob.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("progress_percent", (object?)progressPercent ?? DBNull.Value);
            cmd.Parameters.AddWithValue("progress_message", (object?)progressMessage ?? DBNull.Value);
            cmd.Parameters.AddWithValue("lease_seconds", (int)Math.Ceiling(leaseDuration.TotalSeconds));
        }, cancellationToken);

    public Task<bool> CompleteJobAsync(Guid jobId, string workerId, JsonElement? result, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Jobs/CompleteJob.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.Add(new NpgsqlParameter("result_json", NpgsqlDbType.Jsonb)
            {
                Value = result is null ? DBNull.Value : result.Value.GetRawText()
            });
        }, cancellationToken);

    public Task<bool> FailJobAsync(Guid jobId, string workerId, string errorCode, string errorMessage, JsonElement? errorDetails, bool deadLetter, TimeSpan retryDelay, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Jobs/FailJob.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("error_code", errorCode);
            cmd.Parameters.AddWithValue("error_message", errorMessage);
            cmd.Parameters.Add(new NpgsqlParameter("error_details_json", NpgsqlDbType.Jsonb)
            {
                Value = errorDetails is null ? DBNull.Value : errorDetails.Value.GetRawText()
            });
            cmd.Parameters.AddWithValue("dead_letter", deadLetter);
            cmd.Parameters.AddWithValue("retry_seconds", (int)Math.Ceiling(retryDelay.TotalSeconds));
        }, cancellationToken);

    public Task<bool> CancelJobAsync(Guid jobId, string workerId, string reason, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Jobs/CancelJob.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("worker_id", workerId);
            cmd.Parameters.AddWithValue("reason", reason);
        }, cancellationToken);

    public Task<bool> RequestCancelAsync(Guid jobId, CancellationToken cancellationToken)
        => ExecuteReturningBoolAsync("Jobs/RequestCancel.sql", cmd => cmd.Parameters.AddWithValue("job_id", jobId), cancellationToken);

    public Task<JobLog> AddLogAsync(Guid jobId, int? attemptNo, string level, string message, JsonElement? context, CancellationToken cancellationToken)
        => QuerySingleAsync("Jobs/AddJobLog.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
            cmd.Parameters.AddWithValue("attempt_no", (object?)attemptNo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("level", level);
            cmd.Parameters.AddWithValue("message", message);
            cmd.Parameters.Add(new NpgsqlParameter("context_json", NpgsqlDbType.Jsonb)
            {
                Value = context is null ? "{}" : context.Value.GetRawText()
            });
        }, cancellationToken, MapJobLog);

    private async Task<Job?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapJob(reader) : null;
    }

    private async Task<IReadOnlyList<Job>> QueryManyAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<Job>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapJob(reader));
        }

        return items;
    }

    private async Task<IReadOnlyList<JobLog>> QueryLogsAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<JobLog>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapJobLog(reader));
        }

        return items;
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

    private async Task<bool> ExecuteReturningBoolAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken);
    }

    private static void BindCreateJob(NpgsqlCommand command, Job job)
    {
        command.Parameters.AddWithValue("parent_job_id", (object?)job.ParentJobId ?? DBNull.Value);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)job.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("job_type", job.JobType);
        command.Parameters.AddWithValue("priority", job.Priority);
        command.Parameters.AddWithValue("status", job.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("payload_json", NpgsqlDbType.Jsonb, job.Payload.GetRawText());
        command.Parameters.AddWithValue("result_json", DBNull.Value);
        command.Parameters.AddWithValue("error_code", DBNull.Value);
        command.Parameters.AddWithValue("error_message", DBNull.Value);
        command.Parameters.AddWithValue("error_details_json", DBNull.Value);
        command.Parameters.AddWithValue("attempt_count", job.AttemptCount);
        command.Parameters.AddWithValue("max_attempts", job.MaxAttempts);
        command.Parameters.AddWithValue("available_at", job.AvailableAt.UtcDateTime);
        command.Parameters.AddWithValue("locked_by", DBNull.Value);
        command.Parameters.AddWithValue("locked_at", DBNull.Value);
        command.Parameters.AddWithValue("locked_until", DBNull.Value);
        command.Parameters.AddWithValue("started_at", DBNull.Value);
        command.Parameters.AddWithValue("finished_at", DBNull.Value);
        command.Parameters.AddWithValue("last_error_at", DBNull.Value);
        command.Parameters.AddWithValue("heartbeat_at", DBNull.Value);
        command.Parameters.AddWithValue("progress_percent", DBNull.Value);
        command.Parameters.AddWithValue("progress_message", DBNull.Value);
        command.Parameters.AddWithValue("cancel_requested_at", DBNull.Value);
    }

    private static Job MapJob(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            ParentJobId = reader.IsDBNull(reader.GetOrdinal("parent_job_id")) ? null : reader.GetGuid(reader.GetOrdinal("parent_job_id")),
            RequestedByUserId = reader.IsDBNull(reader.GetOrdinal("requested_by_user_id")) ? null : reader.GetGuid(reader.GetOrdinal("requested_by_user_id")),
            JobType = reader.GetString(reader.GetOrdinal("job_type")),
            Priority = reader.GetInt32(reader.GetOrdinal("priority")),
            Status = Enum.Parse<JobStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            Payload = ParseJson(reader.GetString(reader.GetOrdinal("payload_json"))),
            Result = reader.IsDBNull(reader.GetOrdinal("result_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("result_json"))),
            ErrorCode = reader.IsDBNull(reader.GetOrdinal("error_code")) ? null : reader.GetString(reader.GetOrdinal("error_code")),
            ErrorMessage = reader.IsDBNull(reader.GetOrdinal("error_message")) ? null : reader.GetString(reader.GetOrdinal("error_message")),
            ErrorDetails = reader.IsDBNull(reader.GetOrdinal("error_details_json")) ? null : ParseJson(reader.GetString(reader.GetOrdinal("error_details_json"))),
            AttemptCount = reader.GetInt32(reader.GetOrdinal("attempt_count")),
            MaxAttempts = reader.GetInt32(reader.GetOrdinal("max_attempts")),
            AvailableAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("available_at")),
            LockedBy = reader.IsDBNull(reader.GetOrdinal("locked_by")) ? null : reader.GetString(reader.GetOrdinal("locked_by")),
            LockedAt = reader.IsDBNull(reader.GetOrdinal("locked_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("locked_at")),
            LockedUntil = reader.IsDBNull(reader.GetOrdinal("locked_until")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("locked_until")),
            StartedAt = reader.IsDBNull(reader.GetOrdinal("started_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("started_at")),
            FinishedAt = reader.IsDBNull(reader.GetOrdinal("finished_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("finished_at")),
            LastErrorAt = reader.IsDBNull(reader.GetOrdinal("last_error_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_error_at")),
            HeartbeatAt = reader.IsDBNull(reader.GetOrdinal("heartbeat_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("heartbeat_at")),
            ProgressPercent = reader.IsDBNull(reader.GetOrdinal("progress_percent")) ? null : reader.GetInt16(reader.GetOrdinal("progress_percent")),
            ProgressMessage = reader.IsDBNull(reader.GetOrdinal("progress_message")) ? null : reader.GetString(reader.GetOrdinal("progress_message")),
            CancelRequestedAt = reader.IsDBNull(reader.GetOrdinal("cancel_requested_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("cancel_requested_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static JobLog MapJobLog(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            JobId = reader.GetGuid(reader.GetOrdinal("job_id")),
            AttemptNo = reader.IsDBNull(reader.GetOrdinal("attempt_no")) ? null : reader.GetInt32(reader.GetOrdinal("attempt_no")),
            Level = reader.GetString(reader.GetOrdinal("level")),
            Message = reader.GetString(reader.GetOrdinal("message")),
            Context = ParseJson(reader.GetString(reader.GetOrdinal("context_json"))),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at"))
        };

    private static JsonElement ParseJson(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
