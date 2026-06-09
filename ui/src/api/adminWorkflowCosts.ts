import { getAuthAccessToken } from '../config/auth';
import { getMockWorkflowCostById, getMockWorkflowCosts } from '../mocks/api/adminWorkflowCosts';

export interface WorkflowCostResponse {
  workflowId: string;
  requestedByUserId: string | null;
  requestedByUserEmail: string | null;
  requestedByUserDisplayName: string | null;
  workflowType: string;
  workflowStatus: string;
  sourceId: string | null;
  sourceLabel: string | null;
  reservationId: string | null;
  reservationStatus: string | null;
  estimatedCredits: number;
  finalCredits: number | null;
  sourceType: string | null;
  reason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  settledAt: string | null;
  releasedAt: string | null;
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

export async function listWorkflowCosts(limit = 50, offset = 0, accessToken?: string): Promise<WorkflowCostResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockWorkflowCosts(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<WorkflowCostResponse[]>(`/api/admin/workflow-costs?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getWorkflowCost(workflowId: string, accessToken?: string): Promise<WorkflowCostResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockWorkflowCostById(workflowId);
  }

  return requestJson<WorkflowCostResponse>(`/api/admin/workflow-costs/${encodeURIComponent(workflowId)}`, {
    headers: getAuthHeaders(accessToken),
  });
}
