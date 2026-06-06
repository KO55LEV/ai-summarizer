import data from '../data/searchProviders.json';
import { delay } from './delay';
import type {
  SearchProviderInput,
  SearchProviderResponse,
  SearchProviderUpdateInput,
  SearchProviderUsageResponse,
} from '../../api/searchProviders';

type SearchProviderDataFile = {
  providers: SearchProviderResponse[];
  usage: Record<string, SearchProviderUsageResponse>;
};

const state = structuredClone(data) as SearchProviderDataFile;

function cloneProvider(provider: SearchProviderResponse): SearchProviderResponse {
  return structuredClone(provider);
}

function normalizeProviderName(value: string): string {
  return value.trim();
}

function makeUsage(provider: SearchProviderResponse): SearchProviderUsageResponse {
  return {
    id: provider.id,
    provider: provider.provider,
    quotaPerMonth: provider.quotaPerMonth,
    used: 0,
    cycleStart: new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1).toISOString(),
    cycleEnd: new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1).toISOString(),
  };
}

export async function getMockSearchProviders(limit = 100, offset = 0): Promise<SearchProviderResponse[]> {
  await delay();
  return state.providers.slice(offset, offset + limit).map(cloneProvider);
}

export async function getMockSearchProviderById(id: string): Promise<SearchProviderResponse> {
  await delay();
  const provider = state.providers.find((item) => item.id === id);
  if (!provider) throw new Error('Search provider not found');
  return cloneProvider(provider);
}

export async function createMockSearchProvider(input: SearchProviderInput): Promise<SearchProviderResponse> {
  await delay();
  const now = new Date().toISOString();
  const provider: SearchProviderResponse = {
    id: `mock-${crypto.randomUUID()}`,
    provider: normalizeProviderName(input.provider),
    apiKey: input.apiKey.trim(),
    quotaPerMonth: input.quotaPerMonth,
    isActive: input.isActive ?? true,
    note: input.note?.trim() || null,
  };

  state.providers.unshift(provider);
  state.usage[provider.id] = makeUsage(provider);
  state.usage[provider.id].cycleStart = now;
  return cloneProvider(provider);
}

export async function updateMockSearchProvider(id: string, input: SearchProviderUpdateInput): Promise<SearchProviderResponse> {
  await delay();
  const index = state.providers.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Search provider not found');

  const updated: SearchProviderResponse = {
    id,
    provider: normalizeProviderName(input.provider),
    apiKey: input.apiKey.trim(),
    quotaPerMonth: input.quotaPerMonth,
    isActive: input.isActive,
    note: input.note?.trim() || null,
  };

  state.providers[index] = updated;
  state.usage[id] = {
    ...(state.usage[id] ?? makeUsage(updated)),
    id,
    provider: updated.provider,
    quotaPerMonth: updated.quotaPerMonth,
  };

  return cloneProvider(updated);
}

export async function deleteMockSearchProvider(id: string): Promise<void> {
  await delay();
  state.providers = state.providers.filter((item) => item.id !== id);
  delete state.usage[id];
}

export async function getMockSearchProviderUsage(id: string): Promise<SearchProviderUsageResponse> {
  await delay();
  const usage = state.usage[id];
  if (!usage) {
    const provider = state.providers.find((item) => item.id === id);
    if (!provider) throw new Error('Search provider not found');
    return makeUsage(provider);
  }

  return structuredClone(usage);
}
