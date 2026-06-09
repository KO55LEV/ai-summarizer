using System.Data.Common;
using AiSummarizer.Application.Billing;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace AiSummarizer.Infrastructure.Billing;

public sealed class BillingRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IBillingRepository
{
    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private BillingRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<IBillingRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new BillingRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);

        try
        {
            var result = await action(scopedRepository, transaction);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    public Task EnsureBillingAccountAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Billing/EnsureBillingAccount.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
        }, transaction, cancellationToken);

    public Task<BillingAccountDto?> GetBillingAccountByUserIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Billing/GetBillingAccountByUserId.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
        }, transaction, cancellationToken, MapAccount);

    public Task<BillingAccountDto> GetBillingAccountByUserIdForUpdateAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/GetBillingAccountByUserIdForUpdate.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
        }, transaction, cancellationToken, MapAccount);

    public Task<BillingAccountDto> UpdateBillingAccountAsync(BillingAccountDto account, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/UpdateBillingAccount.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", account.UserId);
            cmd.Parameters.AddWithValue("balance_credits", account.BalanceCredits);
            cmd.Parameters.AddWithValue("reserved_credits", account.ReservedCredits);
            cmd.Parameters.AddWithValue("updated_at", account.UpdatedAt.UtcDateTime);
        }, transaction, cancellationToken, MapAccount);

    public Task<BillingReservationDto?> GetBillingReservationByIdAsync(Guid reservationId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Billing/GetBillingReservationById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("reservation_id", reservationId);
        }, transaction, cancellationToken, MapReservation);

    public Task<BillingReservationDto?> GetBillingReservationBySourceAsync(Guid userId, string sourceType, Guid sourceId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Billing/GetBillingReservationBySource.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
            cmd.Parameters.AddWithValue("source_type", sourceType);
            cmd.Parameters.AddWithValue("source_id", sourceId);
        }, transaction, cancellationToken, MapReservation);

    public Task<BillingReservationDto> CreateBillingReservationAsync(BillingReservationDto reservation, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/CreateBillingReservation.sql", cmd =>
        {
            BindReservation(reservation, cmd);
        }, transaction, cancellationToken, MapReservation);

    public Task<BillingReservationDto> UpdateBillingReservationAsync(BillingReservationDto reservation, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/UpdateBillingReservation.sql", cmd =>
        {
            BindReservation(reservation, cmd);
        }, transaction, cancellationToken, MapReservation);

    public Task<BillingLedgerEntryDto> CreateBillingLedgerEntryAsync(BillingLedgerEntryDto entry, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/CreateBillingLedgerEntry.sql", cmd =>
        {
            BindLedgerEntry(entry, cmd);
        }, transaction, cancellationToken, MapLedgerEntry);

    public Task<IReadOnlyList<BillingLedgerEntryDto>> ListBillingLedgerAsync(Guid userId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Billing/ListBillingLedger.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapLedgerEntry);

    public Task<IReadOnlyList<BillingReservationDto>> ListBillingReservationsAsync(Guid userId, int limit, int offset, CancellationToken cancellationToken)
        => QueryManyAsync("Billing/ListBillingReservations.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
            cmd.Parameters.AddWithValue("limit_value", limit);
            cmd.Parameters.AddWithValue("offset_value", offset);
        }, cancellationToken, MapReservation);

    public Task<IReadOnlyList<BillingRuleDto>> ListBillingRulesAsync(CancellationToken cancellationToken)
        => QueryManyAsync("Billing/ListBillingRules.sql", _ => { }, cancellationToken, MapRule);

    public Task<BillingRuleDto?> GetBillingRuleByIdAsync(Guid ruleId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("Billing/GetBillingRuleById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("rule_id", ruleId);
        }, transaction, cancellationToken, MapRule);

    public Task<BillingRuleDto> CreateBillingRuleAsync(BillingRuleDto rule, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/CreateBillingRule.sql", cmd =>
        {
            BindRule(rule, cmd);
        }, transaction, cancellationToken, MapRule);

    public Task<BillingRuleDto> UpdateBillingRuleAsync(BillingRuleDto rule, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync("Billing/UpdateBillingRule.sql", cmd =>
        {
            BindRule(rule, cmd);
        }, transaction, cancellationToken, MapRule);

    public Task DeleteBillingRuleAsync(Guid ruleId, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Billing/DeleteBillingRule.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("rule_id", ruleId);
        }, transaction, cancellationToken);

    private static void BindReservation(BillingReservationDto reservation, NpgsqlCommand command)
    {
        command.Parameters.AddWithValue("id", reservation.Id);
        command.Parameters.AddWithValue("user_id", reservation.UserId);
        command.Parameters.AddWithValue("source_type", reservation.SourceType);
        command.Parameters.AddWithValue("source_id", reservation.SourceId);
        command.Parameters.AddWithValue("estimated_credits", reservation.EstimatedCredits);
        command.Parameters.AddWithValue("final_credits", (object?)reservation.FinalCredits ?? DBNull.Value);
        command.Parameters.AddWithValue("status", reservation.Status);
        command.Parameters.AddWithValue("reason", (object?)reservation.Reason ?? DBNull.Value);
        command.Parameters.AddWithValue("settled_at", (object?)reservation.SettledAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("released_at", (object?)reservation.ReleasedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("expires_at", (object?)reservation.ExpiresAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("created_at", reservation.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", reservation.UpdatedAt.UtcDateTime);
    }

    private static void BindLedgerEntry(BillingLedgerEntryDto entry, NpgsqlCommand command)
    {
        command.Parameters.AddWithValue("id", entry.Id);
        command.Parameters.AddWithValue("user_id", entry.UserId);
        command.Parameters.AddWithValue("reservation_id", (object?)entry.ReservationId ?? DBNull.Value);
        command.Parameters.AddWithValue("entry_type", entry.EntryType);
        command.Parameters.AddWithValue("amount_credits", entry.AmountCredits);
        command.Parameters.AddWithValue("balance_delta_credits", entry.BalanceDeltaCredits);
        command.Parameters.AddWithValue("reserved_delta_credits", entry.ReservedDeltaCredits);
        command.Parameters.AddWithValue("balance_before_credits", entry.BalanceBeforeCredits);
        command.Parameters.AddWithValue("balance_after_credits", entry.BalanceAfterCredits);
        command.Parameters.AddWithValue("reserved_before_credits", entry.ReservedBeforeCredits);
        command.Parameters.AddWithValue("reserved_after_credits", entry.ReservedAfterCredits);
        command.Parameters.AddWithValue("source_type", (object?)entry.SourceType ?? DBNull.Value);
        command.Parameters.AddWithValue("source_id", (object?)entry.SourceId ?? DBNull.Value);
        command.Parameters.AddWithValue("reason", (object?)entry.Reason ?? DBNull.Value);
        command.Parameters.Add(new NpgsqlParameter("metadata_json", NpgsqlDbType.Jsonb)
        {
            Value = "{}"
        });
        command.Parameters.AddWithValue("created_at", entry.CreatedAt.UtcDateTime);
    }

    private static void BindRule(BillingRuleDto rule, NpgsqlCommand command)
    {
        command.Parameters.AddWithValue("id", rule.Id);
        command.Parameters.AddWithValue("action_type", rule.ActionType);
        command.Parameters.AddWithValue("provider", (object?)rule.Provider ?? DBNull.Value);
        command.Parameters.AddWithValue("model", (object?)rule.Model ?? DBNull.Value);
        command.Parameters.AddWithValue("version", rule.Version);
        command.Parameters.AddWithValue("unit_type", rule.UnitType);
        command.Parameters.AddWithValue("base_fee_credits", rule.BaseFeeCredits);
        command.Parameters.AddWithValue("rate_per_unit_credits", rule.RatePerUnitCredits);
        command.Parameters.AddWithValue("min_credits", rule.MinCredits);
        command.Parameters.AddWithValue("max_credits", (object?)rule.MaxCredits ?? DBNull.Value);
        command.Parameters.AddWithValue("multiplier", rule.Multiplier);
        command.Parameters.AddWithValue("is_active", rule.IsActive);
        command.Parameters.AddWithValue("effective_from", rule.EffectiveFrom.UtcDateTime);
        command.Parameters.AddWithValue("created_at", rule.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("updated_at", rule.UpdatedAt.UtcDateTime);
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null && _transaction is null)
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

        var txConnection = transaction is NpgsqlTransaction npgsqlTransaction ? npgsqlTransaction.Connection : _connection;
        var tx = transaction as NpgsqlTransaction ?? _transaction;
        if (txConnection is null || tx is null)
        {
            throw new InvalidOperationException("Transaction is not associated with a connection.");
        }

        await using var scopedCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, tx);
        configure(scopedCommand);
        await using var scopedReader = await scopedCommand.ExecuteReaderAsync(cancellationToken);
        if (!await scopedReader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException($"No rows returned for {sqlPath}.");
        }

        return mapper(scopedReader);
    }

    private async Task<T?> QuerySingleOrDefaultAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken, Func<NpgsqlDataReader, T> mapper)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? mapper(reader) : default;
        }

        var txConnection = transaction is NpgsqlTransaction npgsqlTransaction ? npgsqlTransaction.Connection : _connection;
        var tx = transaction as NpgsqlTransaction ?? _transaction;
        if (txConnection is null || tx is null)
        {
            throw new InvalidOperationException("Transaction is not associated with a connection.");
        }

        await using var scopedCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, tx);
        configure(scopedCommand);
        await using var scopedReader = await scopedCommand.ExecuteReaderAsync(cancellationToken);
        return await scopedReader.ReadAsync(cancellationToken) ? mapper(scopedReader) : default;
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

    private async Task ExecuteNonQueryAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is null && _transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        var txConnection = transaction is NpgsqlTransaction npgsqlTransaction ? npgsqlTransaction.Connection : _connection;
        var tx = transaction as NpgsqlTransaction ?? _transaction;
        if (txConnection is null || tx is null)
        {
            throw new InvalidOperationException("Transaction is not associated with a connection.");
        }

        await using var scopedCommand = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), txConnection, tx);
        configure(scopedCommand);
        await scopedCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static BillingAccountDto MapAccount(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("user_id")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("balance_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("reserved_credits")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static BillingReservationDto MapReservation(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("user_id")),
            reader.GetString(reader.GetOrdinal("source_type")),
            reader.GetGuid(reader.GetOrdinal("source_id")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("estimated_credits")),
            reader.IsDBNull(reader.GetOrdinal("final_credits")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("final_credits")),
            reader.GetString(reader.GetOrdinal("status")),
            reader.IsDBNull(reader.GetOrdinal("reason")) ? null : reader.GetString(reader.GetOrdinal("reason")),
            reader.IsDBNull(reader.GetOrdinal("settled_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("settled_at")),
            reader.IsDBNull(reader.GetOrdinal("released_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("released_at")),
            reader.IsDBNull(reader.GetOrdinal("expires_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("expires_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));

    private static BillingLedgerEntryDto MapLedgerEntry(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetGuid(reader.GetOrdinal("user_id")),
            reader.IsDBNull(reader.GetOrdinal("reservation_id")) ? null : reader.GetGuid(reader.GetOrdinal("reservation_id")),
            reader.GetString(reader.GetOrdinal("entry_type")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("amount_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("balance_delta_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("reserved_delta_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("balance_before_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("balance_after_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("reserved_before_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("reserved_after_credits")),
            reader.IsDBNull(reader.GetOrdinal("source_type")) ? null : reader.GetString(reader.GetOrdinal("source_type")),
            reader.IsDBNull(reader.GetOrdinal("source_id")) ? null : reader.GetGuid(reader.GetOrdinal("source_id")),
            reader.IsDBNull(reader.GetOrdinal("reason")) ? null : reader.GetString(reader.GetOrdinal("reason")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")));

    private static BillingRuleDto MapRule(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetString(reader.GetOrdinal("action_type")),
            reader.IsDBNull(reader.GetOrdinal("provider")) ? null : reader.GetString(reader.GetOrdinal("provider")),
            reader.IsDBNull(reader.GetOrdinal("model")) ? null : reader.GetString(reader.GetOrdinal("model")),
            reader.GetInt32(reader.GetOrdinal("version")),
            reader.GetString(reader.GetOrdinal("unit_type")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("base_fee_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("rate_per_unit_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("min_credits")),
            reader.IsDBNull(reader.GetOrdinal("max_credits")) ? null : reader.GetFieldValue<decimal>(reader.GetOrdinal("max_credits")),
            reader.GetFieldValue<decimal>(reader.GetOrdinal("multiplier")),
            reader.GetBoolean(reader.GetOrdinal("is_active")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("effective_from")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));
}
