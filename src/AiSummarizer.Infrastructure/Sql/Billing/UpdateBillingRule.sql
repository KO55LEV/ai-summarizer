update billing_rules
set action_type = @action_type,
    provider = @provider,
    model = @model,
    version = @version,
    unit_type = @unit_type,
    base_fee_credits = @base_fee_credits,
    rate_per_unit_credits = @rate_per_unit_credits,
    min_credits = @min_credits,
    max_credits = @max_credits,
    multiplier = @multiplier,
    is_active = @is_active,
    effective_from = @effective_from,
    updated_at = @updated_at
where id = @id
returning id, action_type, provider, model, version, unit_type, base_fee_credits, rate_per_unit_credits, min_credits, max_credits, multiplier, is_active, effective_from, created_at, updated_at;
