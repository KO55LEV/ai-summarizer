import type { DashboardData } from './types';
import { getMockDashboard } from '../mocks/api/dashboard';

export async function getDashboardData(): Promise<DashboardData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockDashboard();
  }
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json() as Promise<DashboardData>;
}
