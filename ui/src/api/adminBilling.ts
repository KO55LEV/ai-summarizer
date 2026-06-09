import { getAuthAccessToken } from '../config/auth';
import {
  getMockBillingBalance,
  getMockBillingLedger,
  getMockBillingReservations,
  topUpMockBillingBalance,
} from '../mocks/api/adminBilling';

export interface BillingBalanceResponse {
  userId: string;
  balanceCredits: number;
  reservedCredits: number;
  availableCredits: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingLedgerEntryResponse {
  id: string;
  userId: string;
  reservationId: string | null;
  entryType: string;
  amountCredits: number;
  balanceDeltaCredits: number;
  reservedDeltaCredits: number;
  balanceBeforeCredits: number;
  balanceAfterCredits: number;
  reservedBeforeCredits: number;
  reservedAfterCredits: number;
  sourceType: string | null;
  sourceId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BillingReservationResponse {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  estimatedCredits: number;
  finalCredits: number | null;
  status: string;
  reason: string | null;
  settledAt: string | null;
  releasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopUpBillingInput {
  requestedByUserId: string;
  credits: number;
  reason?: string | null;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function getAuthHeaders(accessToken?: string): HeadersInit {
  const token = accessToken ?? getAuthAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getBillingBalance(requestedByUserId: string, accessToken?: string): Promise<BillingBalanceResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockBillingBalance(requestedByUserId);
  }

  const params = new URLSearchParams({ requestedByUserId });
  return requestJson<BillingBalanceResponse>(`/api/billing/balance?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function listBillingLedger(requestedByUserId: string, limit = 50, offset = 0, accessToken?: string): Promise<BillingLedgerEntryResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockBillingLedger(requestedByUserId, limit, offset);
  }

  const params = new URLSearchParams({
    requestedByUserId,
    limit: String(limit),
    offset: String(offset),
  });
  return requestJson<BillingLedgerEntryResponse[]>(`/api/billing/ledger?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function listBillingReservations(requestedByUserId: string, limit = 50, offset = 0, accessToken?: string): Promise<BillingReservationResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockBillingReservations(requestedByUserId, limit, offset);
  }

  const params = new URLSearchParams({
    requestedByUserId,
    limit: String(limit),
    offset: String(offset),
  });
  return requestJson<BillingReservationResponse[]>(`/api/billing/reservations?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function topUpBillingBalance(input: TopUpBillingInput, accessToken?: string): Promise<BillingBalanceResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return topUpMockBillingBalance(input);
  }

  return requestJson<BillingBalanceResponse>('/api/billing/topup', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}
