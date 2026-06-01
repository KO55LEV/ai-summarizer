import type { ExportRecord } from './types';
import { getMockExports } from '../mocks/api/exports';

export async function getExports(): Promise<ExportRecord[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockExports();
  }
  const res = await fetch('/api/exports');
  if (!res.ok) throw new Error('Failed to fetch exports');
  return res.json() as Promise<ExportRecord[]>;
}
