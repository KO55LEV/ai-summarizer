namespace AiSummarizer.Api.Billing;

public sealed record BillingBalanceResponse(
    Guid UserId,
    decimal BalanceCredits,
    decimal ReservedCredits,
    decimal AvailableCredits,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record BillingReservationResponse(
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

public sealed record BillingLedgerEntryResponse(
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

public sealed record ReserveBillingCreditsRequest(
    Guid RequestedByUserId,
    string SourceType,
    Guid SourceId,
    decimal EstimatedCredits,
    string? Reason);

public sealed record SettleBillingReservationRequest(
    Guid ReservationId,
    decimal FinalCredits,
    string? Reason);

public sealed record ReleaseBillingReservationRequest(
    Guid ReservationId,
    string? Reason);

public sealed record TopUpBillingCreditsRequest(
    Guid RequestedByUserId,
    decimal Credits,
    string? Reason);
