import { getAuthAccessToken } from '../config/auth';
import type { WorkflowResponse } from '../types';
import type { WorkflowStepResponse } from '../types';
import { getMockActiveWorkflows, getMockHistoryWorkflows, getMockWorkflowEvents, getMockWorkflowSteps } from '../mocks/api/adminWorkflows';

export interface WorkflowEventResponse {
  id: string;
  workflowId: string;
  stepKey: string | null;
  level: string;
  message: string;
  context: Record<string, unknown>;
  createdAt: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function getAuthHeaders(accessToken?: string): HeadersInit {
  const token = accessToken ?? getAuthAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listActiveWorkflows(limit = 50, offset = 0, accessToken?: string): Promise<WorkflowResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockActiveWorkflows(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<WorkflowResponse[]>(`/api/workflows/active?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function listHistoryWorkflows(limit = 50, offset = 0, accessToken?: string): Promise<WorkflowResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockHistoryWorkflows(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<WorkflowResponse[]>(`/api/workflows/history?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getWorkflowEvents(workflowId: string, limit = 100, offset = 0, accessToken?: string): Promise<WorkflowEventResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockWorkflowEvents(workflowId, limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<WorkflowEventResponse[]>(`/api/workflows/${encodeURIComponent(workflowId)}/events?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function getWorkflowSteps(workflowId: string, accessToken?: string): Promise<WorkflowStepResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockWorkflowSteps(workflowId);
  }

  return requestJson<WorkflowStepResponse[]>(`/api/workflows/${encodeURIComponent(workflowId)}/steps`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function requestWorkflowCancel(workflowId: string, accessToken?: string): Promise<boolean> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return true;
  }

  return requestJson<boolean>(`/api/workflows/${encodeURIComponent(workflowId)}/request-cancel`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
}
