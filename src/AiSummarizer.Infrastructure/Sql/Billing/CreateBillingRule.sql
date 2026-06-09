insert into billing_rules (
    id,
    action_type,
    provider,
    model,
    version,
    unit_type,
    base_fee_credits,
    rate_per_unit_credits,
    min_credits,
    max_credits,
    multiplier,
    is_active,
    effective_from,
    created_at,
    updated_at
)
values (
    @id,
    @action_type,
    @provider,
    @model,
    @version,
    @unit_type,
    @base_fee_credits,
    @rate_per_unit_credits,
    @min_credits,
    @max_credits,
    @multiplier,
    @is_active,
    @effective_from,
    @created_at,
    @updated_at
)
returning id, action_type, provider, model, version, unit_type, base_fee_credits, rate_per_unit_credits, min_credits, max_credits, multiplier, is_active, effective_from, created_at, updated_at;
