create table if not exists billing_accounts (
    user_id uuid primary key references users(id) on delete cascade,
    balance_credits numeric(18,4) not null default 0,
    reserved_credits numeric(18,4) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_billing_accounts_balance_non_negative check (balance_credits >= 0),
    constraint ck_billing_accounts_reserved_non_negative check (reserved_credits >= 0),
    constraint ck_billing_accounts_reserved_le_balance check (reserved_credits <= balance_credits)
);

create index if not exists ix_billing_accounts_updated_at
    on billing_accounts (updated_at desc);

drop trigger if exists trg_billing_accounts_updated_at on billing_accounts;
create trigger trg_billing_accounts_updated_at
before update on billing_accounts
for each row
execute function set_updated_at();

create table if not exists billing_reservations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    source_type text not null,
    source_id uuid not null,
    estimated_credits numeric(18,4) not null,
    final_credits numeric(18,4) null,
    status text not null default 'active',
    reason text null,
    settled_at timestamptz null,
    released_at timestamptz null,
    expires_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_billing_reservations_estimated_non_negative check (estimated_credits >= 0),
    constraint ck_billing_reservations_final_non_negative check (final_credits is null or final_credits >= 0),
    constraint ck_billing_reservations_status check (status in ('active', 'settled', 'released', 'expired'))
);

create unique index if not exists ux_billing_reservations_user_source
    on billing_reservations (user_id, source_type, source_id);

create index if not exists ix_billing_reservations_user_status_created_at
    on billing_reservations (user_id, status, created_at desc);

create index if not exists ix_billing_reservations_source
    on billing_reservations (source_type, source_id);

drop trigger if exists trg_billing_reservations_updated_at on billing_reservations;
create trigger trg_billing_reservations_updated_at
before update on billing_reservations
for each row
execute function set_updated_at();

create table if not exists billing_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    reservation_id uuid null references billing_reservations(id) on delete set null,
    entry_type text not null,
    amount_credits numeric(18,4) not null default 0,
    balance_delta_credits numeric(18,4) not null default 0,
    reserved_delta_credits numeric(18,4) not null default 0,
    balance_before_credits numeric(18,4) not null,
    balance_after_credits numeric(18,4) not null,
    reserved_before_credits numeric(18,4) not null,
    reserved_after_credits numeric(18,4) not null,
    source_type text null,
    source_id uuid null,
    reason text null,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint ck_billing_ledger_entry_type check (entry_type in ('topup', 'reserve', 'charge', 'release', 'refund', 'adjustment'))
);

create index if not exists ix_billing_ledger_user_created_at
    on billing_ledger (user_id, created_at desc);

create index if not exists ix_billing_ledger_reservation_created_at
    on billing_ledger (reservation_id, created_at desc);

create table if not exists billing_rules (
    id uuid primary key default gen_random_uuid(),
    action_type text not null,
    provider text null,
    model text null,
    version integer not null default 1,
    unit_type text not null,
    base_fee_credits numeric(18,4) not null default 0,
    rate_per_unit_credits numeric(18,6) not null default 0,
    min_credits numeric(18,4) not null default 0,
    max_credits numeric(18,4) null,
    multiplier numeric(18,6) not null default 1,
    is_active boolean not null default true,
    effective_from timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_billing_rules_unit_type check (unit_type in ('token', 'minute', 'second', 'mb', 'item', 'call', 'fixed')),
    constraint ck_billing_rules_base_fee_non_negative check (base_fee_credits >= 0),
    constraint ck_billing_rules_rate_non_negative check (rate_per_unit_credits >= 0),
    constraint ck_billing_rules_min_non_negative check (min_credits >= 0),
    constraint ck_billing_rules_max_non_negative check (max_credits is null or max_credits >= 0),
    constraint ck_billing_rules_multiplier_positive check (multiplier > 0)
);

create unique index if not exists ux_billing_rules_action_provider_model_version
    on billing_rules (action_type, provider, model, version);

create index if not exists ix_billing_rules_active_effective_from
    on billing_rules (is_active, effective_from desc);

drop trigger if exists trg_billing_rules_updated_at on billing_rules;
create trigger trg_billing_rules_updated_at
before update on billing_rules
for each row
execute function set_updated_at();
