import data from '../data/billing.json';
import { delay } from './delay';
import type {
  BillingBalanceResponse,
  BillingLedgerEntryResponse,
  BillingReservationResponse,
  TopUpBillingInput,
} from '../../api/adminBilling';

type BillingDataFile = {
  accounts: BillingBalanceResponse[];
  ledger: Record<string, BillingLedgerEntryResponse[]>;
  reservations: Record<string, BillingReservationResponse[]>;
};

const state = structuredClone(data) as BillingDataFile;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getAccount(userId: string): BillingBalanceResponse {
  const account = state.accounts.find((item) => item.userId === userId);
  if (!account) {
    const now = new Date().toISOString();
    const created: BillingBalanceResponse = {
      userId,
      balanceCredits: 0,
      reservedCredits: 0,
      availableCredits: 0,
      createdAt: now,
      updatedAt: now,
    };
    state.accounts.unshift(created);
    state.ledger[userId] = [];
    state.reservations[userId] = [];
    return created;
  }

  return account;
}

function normalizeReason(reason?: string | null): string | null {
  const trimmed = reason?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function recomputeAccount(userId: string): BillingBalanceResponse {
  const account = getAccount(userId);
  account.availableCredits = account.balanceCredits - account.reservedCredits;
  return account;
}

export async function getMockBillingBalance(userId: string): Promise<BillingBalanceResponse> {
  await delay();
  return clone(recomputeAccount(userId));
}

export async function getMockBillingLedger(userId: string, limit = 50, offset = 0): Promise<BillingLedgerEntryResponse[]> {
  await delay();
  return clone((state.ledger[userId] ?? []).slice(offset, offset + limit));
}

export async function getMockBillingReservations(userId: string, limit = 50, offset = 0): Promise<BillingReservationResponse[]> {
  await delay();
  return clone((state.reservations[userId] ?? []).slice(offset, offset + limit));
}

export async function topUpMockBillingBalance(input: TopUpBillingInput): Promise<BillingBalanceResponse> {
  await delay();
  const now = new Date().toISOString();
  const account = getAccount(input.requestedByUserId);
  const before = account.balanceCredits;
  account.balanceCredits += input.credits;
  account.availableCredits = account.balanceCredits - account.reservedCredits;
  account.updatedAt = now;

  const entry: BillingLedgerEntryResponse = {
    id: `mock-ledger-${crypto.randomUUID()}`,
    userId: input.requestedByUserId,
    reservationId: null,
    entryType: 'topup',
    amountCredits: input.credits,
    balanceDeltaCredits: input.credits,
    reservedDeltaCredits: 0,
    balanceBeforeCredits: before,
    balanceAfterCredits: account.balanceCredits,
    reservedBeforeCredits: account.reservedCredits,
    reservedAfterCredits: account.reservedCredits,
    sourceType: null,
    sourceId: null,
    reason: normalizeReason(input.reason),
    createdAt: now,
  };

  state.ledger[input.requestedByUserId] = [entry, ...(state.ledger[input.requestedByUserId] ?? [])];
  return clone(account);
}
