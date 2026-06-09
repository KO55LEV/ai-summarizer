import { getAuthAccessToken } from '../config/auth';
import {
  createMockBillingRule,
  deleteMockBillingRule,
  getMockBillingRuleById,
  getMockBillingRules,
  updateMockBillingRule,
} from '../mocks/api/adminBillingRules';

export interface BillingRuleResponse {
  id: string;
  actionType: string;
  provider: string | null;
  model: string | null;
  version: number;
  unitType: string;
  baseFeeCredits: number;
  ratePerUnitCredits: number;
  minCredits: number;
  maxCredits: number | null;
  multiplier: number;
  isActive: boolean;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRuleInput {
  actionType: string;
  provider: string | null;
  model: string | null;
  version: number;
  unitType: string;
  baseFeeCredits: number;
  ratePerUnitCredits: number;
  minCredits: number;
  maxCredits: number | null;
  multiplier: number;
  isActive: boolean;
  effectiveFrom: string;
}

export type BillingRuleUpdateInput = BillingRuleInput;

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

export async function listBillingRules(accessToken?: string): Promise<BillingRuleResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockBillingRules();
  }

  return requestJson<BillingRuleResponse[]>('/api/admin/billing-rules', {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getBillingRule(ruleId: string, accessToken?: string): Promise<BillingRuleResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockBillingRuleById(ruleId);
  }

  return requestJson<BillingRuleResponse>(`/api/admin/billing-rules/${encodeURIComponent(ruleId)}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function createBillingRule(input: BillingRuleInput, accessToken?: string): Promise<BillingRuleResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockBillingRule(input);
  }

  return requestJson<BillingRuleResponse>('/api/admin/billing-rules', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}

export async function updateBillingRule(ruleId: string, input: BillingRuleUpdateInput, accessToken?: string): Promise<BillingRuleResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockBillingRule(ruleId, input);
  }

  return requestJson<BillingRuleResponse>(`/api/admin/billing-rules/${encodeURIComponent(ruleId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: getAuthHeaders(accessToken),
  });
}

export async function deleteBillingRule(ruleId: string, accessToken?: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    deleteMockBillingRule(ruleId);
    return;
  }

  await requestJson<void>(`/api/admin/billing-rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });
}
