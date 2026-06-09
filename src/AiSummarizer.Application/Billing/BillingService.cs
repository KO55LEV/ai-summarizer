using System.Data.Common;
using AiSummarizer.Application.Users;

namespace AiSummarizer.Application.Billing;

public sealed class BillingService(IBillingRepository billingRepository, IUsersRepository usersRepository) : IBillingService
{
    public async Task<BillingBalanceDto> GetBalanceAsync(Guid requestedByUserId, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(requestedByUserId, null, cancellationToken);
        await billingRepository.EnsureBillingAccountAsync(requestedByUserId, null, cancellationToken);
        var account = await billingRepository.GetBillingAccountByUserIdAsync(requestedByUserId, null, cancellationToken)
            ?? throw new BillingNotFoundException("Billing account not found.");
        return new BillingBalanceDto(account);
    }

    public async Task<IReadOnlyList<BillingLedgerEntryDto>> ListLedgerAsync(Guid requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(requestedByUserId, null, cancellationToken);
        return await billingRepository.ListBillingLedgerAsync(requestedByUserId, limit, offset, cancellationToken);
    }

    public async Task<IReadOnlyList<BillingReservationDto>> ListReservationsAsync(Guid requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(requestedByUserId, null, cancellationToken);
        return await billingRepository.ListBillingReservationsAsync(requestedByUserId, limit, offset, cancellationToken);
    }

    public async Task<BillingReservationDto?> GetReservationBySourceAsync(Guid requestedByUserId, string sourceType, Guid sourceId, CancellationToken cancellationToken)
    {
        await EnsureUserExistsAsync(requestedByUserId, null, cancellationToken);
        return await billingRepository.GetBillingReservationBySourceAsync(requestedByUserId, sourceType, sourceId, null, cancellationToken);
    }

    public Task<BillingReservationDto> ReserveAsync(ReserveBillingCreditsCommand command, CancellationToken cancellationToken)
    {
        ValidateReserveCommand(command);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            await EnsureUserExistsAsync(command.RequestedByUserId, transaction, cancellationToken);
            await txRepository.EnsureBillingAccountAsync(command.RequestedByUserId, transaction, cancellationToken);

            var existingReservation = await txRepository.GetBillingReservationBySourceAsync(
                command.RequestedByUserId,
                command.SourceType,
                command.SourceId,
                transaction,
                cancellationToken);

            if (existingReservation is not null)
            {
                return existingReservation;
            }

            var account = await txRepository.GetBillingAccountByUserIdForUpdateAsync(command.RequestedByUserId, transaction, cancellationToken);
            var availableCredits = account.AvailableCredits;
            if (availableCredits < command.EstimatedCredits)
            {
                throw new BillingInsufficientFundsException(
                    $"Insufficient billing credits. Available {availableCredits:0.####}, required {command.EstimatedCredits:0.####}.");
            }

            var now = DateTimeOffset.UtcNow;
            var reservation = new BillingReservationDto(
                Guid.NewGuid(),
                command.RequestedByUserId,
                command.SourceType.Trim(),
                command.SourceId,
                command.EstimatedCredits,
                null,
                "active",
                string.IsNullOrWhiteSpace(command.Reason) ? null : command.Reason.Trim(),
                null,
                null,
                null,
                now,
                now);

            await txRepository.CreateBillingReservationAsync(reservation, transaction, cancellationToken);
            await txRepository.UpdateBillingAccountAsync(
                account with { ReservedCredits = account.ReservedCredits + command.EstimatedCredits, UpdatedAt = now },
                transaction,
                cancellationToken);

            await txRepository.CreateBillingLedgerEntryAsync(
                new BillingLedgerEntryDto(
                    Guid.NewGuid(),
                    command.RequestedByUserId,
                    reservation.Id,
                    "reserve",
                    command.EstimatedCredits,
                    0,
                    command.EstimatedCredits,
                    account.BalanceCredits,
                    account.BalanceCredits,
                    account.ReservedCredits,
                    account.ReservedCredits + command.EstimatedCredits,
                    command.SourceType.Trim(),
                    command.SourceId,
                    string.IsNullOrWhiteSpace(command.Reason) ? null : command.Reason.Trim(),
                    now),
                transaction,
                cancellationToken);

            return reservation;
        }, cancellationToken);
    }

    public Task<BillingReservationDto> SettleAsync(SettleBillingReservationCommand command, CancellationToken cancellationToken)
    {
        ValidateSettleCommand(command);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            var reservation = await txRepository.GetBillingReservationByIdAsync(command.ReservationId, transaction, cancellationToken)
                ?? throw new BillingNotFoundException("Billing reservation not found.");

            if (!string.Equals(reservation.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                if (string.Equals(reservation.Status, "settled", StringComparison.OrdinalIgnoreCase) || string.Equals(reservation.Status, "released", StringComparison.OrdinalIgnoreCase))
                {
                    return reservation;
                }

                throw new BillingValidationException($"Billing reservation cannot be settled in status '{reservation.Status}'.");
            }

            await EnsureUserExistsAsync(reservation.UserId, transaction, cancellationToken);
            await txRepository.EnsureBillingAccountAsync(reservation.UserId, transaction, cancellationToken);
            var account = await txRepository.GetBillingAccountByUserIdForUpdateAsync(reservation.UserId, transaction, cancellationToken);

            if (command.FinalCredits > account.BalanceCredits)
            {
                throw new BillingInsufficientFundsException(
                    $"Insufficient billing credits. Available {account.BalanceCredits:0.####}, required {command.FinalCredits:0.####}.");
            }

            var reservedAfter = account.ReservedCredits - reservation.EstimatedCredits;
            if (reservedAfter < 0)
            {
                throw new BillingValidationException("Reservation exceeds the reserved balance.");
            }

            var balanceAfter = account.BalanceCredits - command.FinalCredits;
            if (balanceAfter < reservedAfter)
            {
                throw new BillingInsufficientFundsException(
                    $"Insufficient billing credits after settlement. Available {account.BalanceCredits:0.####}, required {command.FinalCredits:0.####}.");
            }

            var now = DateTimeOffset.UtcNow;
            await txRepository.UpdateBillingAccountAsync(
                account with { BalanceCredits = balanceAfter, ReservedCredits = reservedAfter, UpdatedAt = now },
                transaction,
                cancellationToken);

            await txRepository.CreateBillingLedgerEntryAsync(
                new BillingLedgerEntryDto(
                    Guid.NewGuid(),
                    reservation.UserId,
                    reservation.Id,
                    "charge",
                    command.FinalCredits,
                    -command.FinalCredits,
                    0,
                    account.BalanceCredits,
                    balanceAfter,
                    account.ReservedCredits,
                    account.ReservedCredits,
                    reservation.SourceType,
                    reservation.SourceId,
                    string.IsNullOrWhiteSpace(command.Reason) ? reservation.Reason : command.Reason.Trim(),
                    now),
                transaction,
                cancellationToken);

            await txRepository.CreateBillingLedgerEntryAsync(
                new BillingLedgerEntryDto(
                    Guid.NewGuid(),
                    reservation.UserId,
                    reservation.Id,
                    "release",
                    reservation.EstimatedCredits,
                    0,
                    -reservation.EstimatedCredits,
                    balanceAfter,
                    balanceAfter,
                    account.ReservedCredits,
                    reservedAfter,
                    reservation.SourceType,
                    reservation.SourceId,
                    string.IsNullOrWhiteSpace(command.Reason) ? reservation.Reason : command.Reason.Trim(),
                    now),
                transaction,
                cancellationToken);

            var updatedReservation = reservation with
            {
                FinalCredits = command.FinalCredits,
                Status = "settled",
                SettledAt = now,
                Reason = string.IsNullOrWhiteSpace(command.Reason) ? reservation.Reason : command.Reason.Trim(),
                UpdatedAt = now
            };

            await txRepository.UpdateBillingReservationAsync(updatedReservation, transaction, cancellationToken);
            return updatedReservation;
        }, cancellationToken);
    }

    public Task<BillingReservationDto> ReleaseAsync(ReleaseBillingReservationCommand command, CancellationToken cancellationToken)
    {
        ValidateReleaseCommand(command);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            var reservation = await txRepository.GetBillingReservationByIdAsync(command.ReservationId, transaction, cancellationToken)
                ?? throw new BillingNotFoundException("Billing reservation not found.");

            if (string.Equals(reservation.Status, "released", StringComparison.OrdinalIgnoreCase) || string.Equals(reservation.Status, "settled", StringComparison.OrdinalIgnoreCase))
            {
                return reservation;
            }

            if (!string.Equals(reservation.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                throw new BillingValidationException($"Billing reservation cannot be released in status '{reservation.Status}'.");
            }

            await EnsureUserExistsAsync(reservation.UserId, transaction, cancellationToken);
            await txRepository.EnsureBillingAccountAsync(reservation.UserId, transaction, cancellationToken);
            var account = await txRepository.GetBillingAccountByUserIdForUpdateAsync(reservation.UserId, transaction, cancellationToken);

            var reservedAfter = account.ReservedCredits - reservation.EstimatedCredits;
            if (reservedAfter < 0)
            {
                throw new BillingValidationException("Reservation exceeds the reserved balance.");
            }

            var now = DateTimeOffset.UtcNow;
            await txRepository.UpdateBillingAccountAsync(
                account with { ReservedCredits = reservedAfter, UpdatedAt = now },
                transaction,
                cancellationToken);

            await txRepository.CreateBillingLedgerEntryAsync(
                new BillingLedgerEntryDto(
                    Guid.NewGuid(),
                    reservation.UserId,
                    reservation.Id,
                    "release",
                    reservation.EstimatedCredits,
                    0,
                    -reservation.EstimatedCredits,
                    account.BalanceCredits,
                    account.BalanceCredits,
                    account.ReservedCredits,
                    reservedAfter,
                    reservation.SourceType,
                    reservation.SourceId,
                    string.IsNullOrWhiteSpace(command.Reason) ? reservation.Reason : command.Reason.Trim(),
                    now),
                transaction,
                cancellationToken);

            var updatedReservation = reservation with
            {
                Status = "released",
                ReleasedAt = now,
                Reason = string.IsNullOrWhiteSpace(command.Reason) ? reservation.Reason : command.Reason.Trim(),
                UpdatedAt = now
            };

            await txRepository.UpdateBillingReservationAsync(updatedReservation, transaction, cancellationToken);
            return updatedReservation;
        }, cancellationToken);
    }

    public Task<BillingBalanceDto> TopUpAsync(TopUpBillingCreditsCommand command, CancellationToken cancellationToken)
    {
        ValidateTopUpCommand(command);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            await EnsureUserExistsAsync(command.RequestedByUserId, transaction, cancellationToken);
            await txRepository.EnsureBillingAccountAsync(command.RequestedByUserId, transaction, cancellationToken);
            var account = await txRepository.GetBillingAccountByUserIdForUpdateAsync(command.RequestedByUserId, transaction, cancellationToken);
            var now = DateTimeOffset.UtcNow;
            var nextBalance = account.BalanceCredits + command.Credits;

            var updatedAccount = account with { BalanceCredits = nextBalance, UpdatedAt = now };
            await txRepository.UpdateBillingAccountAsync(updatedAccount, transaction, cancellationToken);

            await txRepository.CreateBillingLedgerEntryAsync(
                new BillingLedgerEntryDto(
                    Guid.NewGuid(),
                    command.RequestedByUserId,
                    null,
                    "topup",
                    command.Credits,
                    command.Credits,
                    0,
                    account.BalanceCredits,
                    nextBalance,
                    account.ReservedCredits,
                    account.ReservedCredits,
                    null,
                    null,
                    string.IsNullOrWhiteSpace(command.Reason) ? null : command.Reason.Trim(),
                    now),
                transaction,
                cancellationToken);

            return new BillingBalanceDto(updatedAccount);
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<BillingRuleDto>> ListRulesAsync(CancellationToken cancellationToken)
        => await billingRepository.ListBillingRulesAsync(cancellationToken);

    public async Task<BillingRuleDto?> GetRuleAsync(Guid ruleId, CancellationToken cancellationToken)
        => await billingRepository.GetBillingRuleByIdAsync(ruleId, null, cancellationToken);

    public Task<BillingRuleDto> CreateRuleAsync(CreateBillingRuleCommand command, CancellationToken cancellationToken)
    {
        ValidateRuleCommand(command.ActionType, command.UnitType, command.Version, command.BaseFeeCredits, command.RatePerUnitCredits, command.MinCredits, command.MaxCredits, command.Multiplier);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            var now = DateTimeOffset.UtcNow;
            var rule = new BillingRuleDto(
                Guid.NewGuid(),
                command.ActionType.Trim(),
                NormalizeNullable(command.Provider),
                NormalizeNullable(command.Model),
                command.Version,
                command.UnitType.Trim(),
                command.BaseFeeCredits,
                command.RatePerUnitCredits,
                command.MinCredits,
                command.MaxCredits,
                command.Multiplier,
                command.IsActive,
                command.EffectiveFrom,
                now,
                now);

            return await txRepository.CreateBillingRuleAsync(rule, transaction, cancellationToken);
        }, cancellationToken);
    }

    public Task<BillingRuleDto> UpdateRuleAsync(Guid ruleId, UpdateBillingRuleCommand command, CancellationToken cancellationToken)
    {
        ValidateRuleCommand(command.ActionType, command.UnitType, command.Version, command.BaseFeeCredits, command.RatePerUnitCredits, command.MinCredits, command.MaxCredits, command.Multiplier);

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            var existing = await txRepository.GetBillingRuleByIdAsync(ruleId, transaction, cancellationToken)
                ?? throw new BillingNotFoundException("Billing rule not found.");

            var now = DateTimeOffset.UtcNow;
            var updated = existing with
            {
                ActionType = command.ActionType.Trim(),
                Provider = NormalizeNullable(command.Provider),
                Model = NormalizeNullable(command.Model),
                Version = command.Version,
                UnitType = command.UnitType.Trim(),
                BaseFeeCredits = command.BaseFeeCredits,
                RatePerUnitCredits = command.RatePerUnitCredits,
                MinCredits = command.MinCredits,
                MaxCredits = command.MaxCredits,
                Multiplier = command.Multiplier,
                IsActive = command.IsActive,
                EffectiveFrom = command.EffectiveFrom,
                UpdatedAt = now
            };

            return await txRepository.UpdateBillingRuleAsync(updated, transaction, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteRuleAsync(Guid ruleId, CancellationToken cancellationToken)
    {
        if (ruleId == Guid.Empty)
        {
            throw new BillingValidationException("RuleId is required.");
        }

        return billingRepository.ExecuteInTransactionAsync(async (txRepository, transaction) =>
        {
            await txRepository.DeleteBillingRuleAsync(ruleId, transaction, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private async Task EnsureUserExistsAsync(Guid requestedByUserId, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        var user = await usersRepository.GetUserByIdAsync(requestedByUserId, transaction, cancellationToken);
        if (user is null)
        {
            throw new BillingValidationException("RequestedByUserId must reference an existing user.");
        }
    }

    private static void ValidateReserveCommand(ReserveBillingCreditsCommand command)
    {
        if (command.RequestedByUserId == Guid.Empty)
        {
            throw new BillingValidationException("RequestedByUserId is required.");
        }

        if (string.IsNullOrWhiteSpace(command.SourceType))
        {
            throw new BillingValidationException("SourceType is required.");
        }

        if (command.SourceId == Guid.Empty)
        {
            throw new BillingValidationException("SourceId is required.");
        }

        if (command.EstimatedCredits < 0)
        {
            throw new BillingValidationException("EstimatedCredits must be greater than or equal to zero.");
        }
    }

    private static void ValidateSettleCommand(SettleBillingReservationCommand command)
    {
        if (command.ReservationId == Guid.Empty)
        {
            throw new BillingValidationException("ReservationId is required.");
        }

        if (command.FinalCredits < 0)
        {
            throw new BillingValidationException("FinalCredits must be greater than or equal to zero.");
        }
    }

    private static void ValidateReleaseCommand(ReleaseBillingReservationCommand command)
    {
        if (command.ReservationId == Guid.Empty)
        {
            throw new BillingValidationException("ReservationId is required.");
        }
    }

    private static void ValidateTopUpCommand(TopUpBillingCreditsCommand command)
    {
        if (command.RequestedByUserId == Guid.Empty)
        {
            throw new BillingValidationException("RequestedByUserId is required.");
        }

        if (command.Credits <= 0)
        {
            throw new BillingValidationException("Credits must be greater than zero.");
        }
    }

    private static void ValidateRuleCommand(
        string actionType,
        string unitType,
        int version,
        decimal baseFeeCredits,
        decimal ratePerUnitCredits,
        decimal minCredits,
        decimal? maxCredits,
        decimal multiplier)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            throw new BillingValidationException("ActionType is required.");
        }

        if (string.IsNullOrWhiteSpace(unitType))
        {
            throw new BillingValidationException("UnitType is required.");
        }

        if (version <= 0)
        {
            throw new BillingValidationException("Version must be greater than zero.");
        }

        if (baseFeeCredits < 0 || ratePerUnitCredits < 0 || minCredits < 0)
        {
            throw new BillingValidationException("Fees must be non-negative.");
        }

        if (maxCredits is not null && maxCredits < 0)
        {
            throw new BillingValidationException("MaxCredits must be non-negative.");
        }

        if (multiplier <= 0)
        {
            throw new BillingValidationException("Multiplier must be greater than zero.");
        }
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
