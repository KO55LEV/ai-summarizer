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
        => QuerySingleOrDefaultAsync("Jobs/GetJobById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("job_id", jobId);
        }, cancellationToken);

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

    private static void BindCreateJob(NpgsqlCommand command, Job job)
    {
        command.Parameters.AddWithValue("parent_job_id", (object?)job.ParentJobId ?? DBNull.Value);
        command.Parameters.AddWithValue("requested_by_user_id", (object?)job.RequestedByUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("job_type", job.JobType);
        command.Parameters.AddWithValue("priority", job.Priority);
        command.Parameters.AddWithValue("status", job.Status.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("payload_json", NpgsqlDbType.Jsonb, job.Payload.GetRawText());
        command.Parameters.AddWithValue("result_json", NpgsqlDbType.Jsonb, DBNull.Value);
        command.Parameters.AddWithValue("error_code", DBNull.Value);
        command.Parameters.AddWithValue("error_message", DBNull.Value);
        command.Parameters.AddWithValue("error_details_json", NpgsqlDbType.Jsonb, DBNull.Value);
        command.Parameters.AddWithValue("attempt_count", job.AttemptCount);
        command.Parameters.AddWithValue("max_attempts", job.MaxAttempts);
        command.Parameters.AddWithValue("available_at", job.AvailableAt.UtcDateTime);
        command.Parameters.AddWithValue("locked_by", DBNull.Value);
        command.Parameters.AddWithValue("locked_at", DBNull.Value);
        command.Parameters.AddWithValue("locked_until", DBNull.Value);
        command.Parameters.AddWithValue("started_at", DBNull.Value);
        command.Parameters.AddWithValue("finished_at", DBNull.Value);
        command.Parameters.AddWithValue("last_error_at", DBNull.Value);
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
