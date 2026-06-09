namespace AiSummarizer.Application.Billing;

public sealed record BillingAccountDto(
    Guid UserId,
    decimal BalanceCredits,
    decimal ReservedCredits,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public decimal AvailableCredits => BalanceCredits - ReservedCredits;
}

public sealed record BillingReservationDto(
    Guid Id,
    Guid UserId,
    string SourceType,
    Guid SourceId,
    decimal EstimatedCredits,
    decimal? FinalCredits,
    string Status,
    string? Reason,
    DateTimeOffset? SettledAt,
    DateTimeOffset? ReleasedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record BillingLedgerEntryDto(
    Guid Id,
    Guid UserId,
    Guid? ReservationId,
    string EntryType,
    decimal AmountCredits,
    decimal BalanceDeltaCredits,
    decimal ReservedDeltaCredits,
    decimal BalanceBeforeCredits,
    decimal BalanceAfterCredits,
    decimal ReservedBeforeCredits,
    decimal ReservedAfterCredits,
    string? SourceType,
    Guid? SourceId,
    string? Reason,
    DateTimeOffset CreatedAt);

public sealed record BillingRuleDto(
    Guid Id,
    string ActionType,
    string? Provider,
    string? Model,
    int Version,
    string UnitType,
    decimal BaseFeeCredits,
    decimal RatePerUnitCredits,
    decimal MinCredits,
    decimal? MaxCredits,
    decimal Multiplier,
    bool IsActive,
    DateTimeOffset EffectiveFrom,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record BillingBalanceDto(BillingAccountDto Account)
{
    public decimal BalanceCredits => Account.BalanceCredits;
    public decimal ReservedCredits => Account.ReservedCredits;
    public decimal AvailableCredits => Account.AvailableCredits;
}

public sealed record ReserveBillingCreditsCommand(
    Guid RequestedByUserId,
    string SourceType,
    Guid SourceId,
    decimal EstimatedCredits,
    string? Reason);

public sealed record SettleBillingReservationCommand(
    Guid ReservationId,
    decimal FinalCredits,
    string? Reason);

public sealed record ReleaseBillingReservationCommand(
    Guid ReservationId,
    string? Reason);

public sealed record TopUpBillingCreditsCommand(
    Guid RequestedByUserId,
    decimal Credits,
    string? Reason);

public sealed record CreateBillingRuleCommand(
    string ActionType,
    string? Provider,
    string? Model,
    int Version,
    string UnitType,
    decimal BaseFeeCredits,
    decimal RatePerUnitCredits,
    decimal MinCredits,
    decimal? MaxCredits,
    decimal Multiplier,
    bool IsActive,
    DateTimeOffset EffectiveFrom);

public sealed record UpdateBillingRuleCommand(
    string ActionType,
    string? Provider,
    string? Model,
    int Version,
    string UnitType,
    decimal BaseFeeCredits,
    decimal RatePerUnitCredits,
    decimal MinCredits,
    decimal? MaxCredits,
    decimal Multiplier,
    bool IsActive,
    DateTimeOffset EffectiveFrom);
