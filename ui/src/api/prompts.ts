import { getMockPromptArchives, getMockPromptById, getMockPromptRuns, getMockPromptUsage, getMockPrompts, createMockPrompt, updateMockPrompt, deleteMockPrompt } from '../mocks/api/prompts';

export interface PromptResponse {
  id: string;
  promptKey: string;
  title: string;
  description: string | null;
  workflowType: string | null;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptArchiveResponse {
  id: string;
  promptId: string;
  archiveVersion: number;
  archiveReason: string;
  promptKey: string;
  title: string;
  description: string | null;
  workflowType: string | null;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
  archivedAt: string;
  sourceUpdatedAt: string;
}

export interface PromptRunResponse {
  id: string;
  promptId: string;
  workflowId: string | null;
  stepKey: string | null;
  promptKey: string;
  title: string;
  workflowType: string | null;
  provider: string;
  model: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRunUsageResponse {
  promptId: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  runningRuns: number;
  lastRunAt: string | null;
  lastStatus: string | null;
}

export interface PromptInput {
  promptKey: string;
  title: string;
  description?: string | null;
  workflowType?: string | null;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  isActive?: boolean;
}

export interface PromptUpdateInput {
  promptKey: string;
  title: string;
  description?: string | null;
  workflowType?: string | null;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
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
    throw new Error(`Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function listPrompts(limit = 100, offset = 0): Promise<PromptResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockPrompts(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<PromptResponse[]>(`/api/prompts?${params.toString()}`);
}

export async function getPrompt(promptId: string): Promise<PromptResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockPromptById(promptId);
  }

  return requestJson<PromptResponse>(`/api/prompts/${promptId}`);
}

export async function createPrompt(input: PromptInput): Promise<PromptResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockPrompt(input);
  }

  return requestJson<PromptResponse>('/api/prompts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePrompt(promptId: string, input: PromptUpdateInput): Promise<PromptResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockPrompt(promptId, input);
  }

  return requestJson<PromptResponse>(`/api/prompts/${promptId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deletePrompt(promptId: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    deleteMockPrompt(promptId);
    return;
  }

  await requestJson<void>(`/api/prompts/${promptId}`, { method: 'DELETE' });
}

export async function listPromptArchives(promptId: string, limit = 100, offset = 0): Promise<PromptArchiveResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockPromptArchives(promptId, limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<PromptArchiveResponse[]>(`/api/prompts/${promptId}/archive?${params.toString()}`);
}

export async function listPromptRuns(promptId: string, limit = 100, offset = 0): Promise<PromptRunResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockPromptRuns(promptId, limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<PromptRunResponse[]>(`/api/prompts/${promptId}/runs?${params.toString()}`);
}

export async function getPromptUsage(promptId: string): Promise<PromptRunUsageResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockPromptUsage(promptId);
  }

  return requestJson<PromptRunUsageResponse>(`/api/prompts/${promptId}/usage`);
}
