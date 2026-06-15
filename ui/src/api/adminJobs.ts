import { getAuthAccessToken } from '../config/auth';
import { getMockActiveJobs, getMockHistoryJobs, getMockJobLogs, requestMockJobCancel } from '../mocks/api/adminJobs';

export interface JobResponse {
  id: string;
  parentJobId: string | null;
  requestedByUserId: string | null;
  jobType: string;
  priority: number;
  status: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastErrorAt: string | null;
  heartbeatAt: string | null;
  progressPercent: number | null;
  progressMessage: string | null;
  cancelRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobLogResponse {
  id: string;
  jobId: string;
  attemptNo: number | null;
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

export async function getJobLogs(jobId: string, limit = 100, offset = 0, accessToken?: string): Promise<JobLogResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockJobLogs(jobId, limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<JobLogResponse[]>(`/internal/jobs/${encodeURIComponent(jobId)}/logs?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function listActiveJobs(limit = 50, offset = 0, accessToken?: string): Promise<JobResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockActiveJobs(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<JobResponse[]>(`/internal/jobs/active?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function listHistoryJobs(limit = 50, offset = 0, accessToken?: string): Promise<JobResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockHistoryJobs(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<JobResponse[]>(`/internal/jobs/history?${params.toString()}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export async function requestJobCancel(jobId: string, accessToken?: string): Promise<boolean> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return requestMockJobCancel(jobId);
  }

  return requestJson<boolean>(`/internal/jobs/${encodeURIComponent(jobId)}/request-cancel`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
}
