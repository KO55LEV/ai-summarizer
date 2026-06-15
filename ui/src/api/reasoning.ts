import { delay } from '../mocks/api/delay';
import { getMockReasoningProviders, runMockReasoningChat } from '../mocks/api/reasoning';

export interface ReasoningChatMessage {
  role: string;
  content: string;
}

export interface ReasoningChatInput {
  provider: string;
  model?: string | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
  messages?: ReasoningChatMessage[] | null;
  temperature?: number | null;
  maxTokens?: number | null;
  responseFormat?: string | null;
}

export interface ReasoningUsageResponse {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ReasoningChatResponse {
  provider: string;
  model: string;
  text: string;
  finishReason: string | null;
  usage: ReasoningUsageResponse | null;
  rawResponseJson: string;
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
    const error = await res.json().catch(() => ({ message: `Request failed (${res.status})` }));
    throw new Error(error.message || error.detail || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export async function listReasoningProviders(): Promise<string[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    await delay();
    return getMockReasoningProviders();
  }

  return requestJson<string[]>('/api/reasoning/providers');
}

export async function runReasoningChat(input: ReasoningChatInput): Promise<ReasoningChatResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return runMockReasoningChat(input);
  }

  return requestJson<ReasoningChatResponse>('/api/reasoning/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
