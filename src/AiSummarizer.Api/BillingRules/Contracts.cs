namespace AiSummarizer.Api.BillingRules;

public sealed record BillingRuleResponse(
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

public sealed record CreateBillingRuleRequest(
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

public sealed record UpdateBillingRuleRequest(
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
