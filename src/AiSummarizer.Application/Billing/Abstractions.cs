using System.Data.Common;

namespace AiSummarizer.Application.Billing;

public interface IBillingRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IBillingRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task EnsureBillingAccountAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingAccountDto?> GetBillingAccountByUserIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingAccountDto> GetBillingAccountByUserIdForUpdateAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingAccountDto> UpdateBillingAccountAsync(BillingAccountDto account, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingReservationDto?> GetBillingReservationByIdAsync(Guid reservationId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingReservationDto?> GetBillingReservationBySourceAsync(Guid userId, string sourceType, Guid sourceId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingReservationDto> CreateBillingReservationAsync(BillingReservationDto reservation, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingReservationDto> UpdateBillingReservationAsync(BillingReservationDto reservation, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingLedgerEntryDto> CreateBillingLedgerEntryAsync(BillingLedgerEntryDto entry, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingLedgerEntryDto>> ListBillingLedgerAsync(Guid userId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingReservationDto>> ListBillingReservationsAsync(Guid userId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingRuleDto>> ListBillingRulesAsync(CancellationToken cancellationToken);
    Task<BillingRuleDto?> GetBillingRuleByIdAsync(Guid ruleId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingRuleDto> CreateBillingRuleAsync(BillingRuleDto rule, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<BillingRuleDto> UpdateBillingRuleAsync(BillingRuleDto rule, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteBillingRuleAsync(Guid ruleId, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface IBillingService
{
    Task<BillingBalanceDto> GetBalanceAsync(Guid requestedByUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingLedgerEntryDto>> ListLedgerAsync(Guid requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingReservationDto>> ListReservationsAsync(Guid requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<BillingReservationDto?> GetReservationBySourceAsync(Guid requestedByUserId, string sourceType, Guid sourceId, CancellationToken cancellationToken);
    Task<BillingReservationDto> ReserveAsync(ReserveBillingCreditsCommand command, CancellationToken cancellationToken);
    Task<BillingReservationDto> SettleAsync(SettleBillingReservationCommand command, CancellationToken cancellationToken);
    Task<BillingReservationDto> ReleaseAsync(ReleaseBillingReservationCommand command, CancellationToken cancellationToken);
    Task<BillingBalanceDto> TopUpAsync(TopUpBillingCreditsCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<BillingRuleDto>> ListRulesAsync(CancellationToken cancellationToken);
    Task<BillingRuleDto?> GetRuleAsync(Guid ruleId, CancellationToken cancellationToken);
    Task<BillingRuleDto> CreateRuleAsync(CreateBillingRuleCommand command, CancellationToken cancellationToken);
    Task<BillingRuleDto> UpdateRuleAsync(Guid ruleId, UpdateBillingRuleCommand command, CancellationToken cancellationToken);
    Task DeleteRuleAsync(Guid ruleId, CancellationToken cancellationToken);
}
