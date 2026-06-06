import {
  createMockSearchProvider,
  deleteMockSearchProvider,
  getMockSearchProviderById,
  getMockSearchProviderUsage,
  getMockSearchProviders,
  updateMockSearchProvider,
} from '../mocks/api/searchProviders';

export interface SearchProviderResponse {
  id: string;
  provider: string;
  apiKey: string;
  quotaPerMonth: number;
  isActive: boolean;
  note: string | null;
}

export interface SearchProviderUsageResponse {
  id: string;
  provider: string;
  quotaPerMonth: number;
  used: number;
  cycleStart: string;
  cycleEnd: string;
}

export interface SearchProviderInput {
  provider: string;
  apiKey: string;
  quotaPerMonth: number;
  isActive?: boolean;
  note?: string | null;
}

export interface SearchProviderUpdateInput {
  provider: string;
  apiKey: string;
  quotaPerMonth: number;
  isActive: boolean;
  note?: string | null;
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

export async function listSearchProviders(limit = 100, offset = 0): Promise<SearchProviderResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockSearchProviders(limit, offset);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return requestJson<SearchProviderResponse[]>(`/api/search-providers?${params.toString()}`);
}

export async function getSearchProvider(id: string): Promise<SearchProviderResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockSearchProviderById(id);
  }

  return requestJson<SearchProviderResponse>(`/api/search-providers/${id}`);
}

export async function createSearchProvider(input: SearchProviderInput): Promise<SearchProviderResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockSearchProvider(input);
  }

  return requestJson<SearchProviderResponse>('/api/search-providers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSearchProvider(id: string, input: SearchProviderUpdateInput): Promise<SearchProviderResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockSearchProvider(id, input);
  }

  return requestJson<SearchProviderResponse>(`/api/search-providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteSearchProvider(id: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    deleteMockSearchProvider(id);
    return;
  }

  await requestJson<void>(`/api/search-providers/${id}`, { method: 'DELETE' });
}

export async function getSearchProviderUsage(id: string): Promise<SearchProviderUsageResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockSearchProviderUsage(id);
  }

  return requestJson<SearchProviderUsageResponse>(`/api/search-providers/${id}/usage`);
}
