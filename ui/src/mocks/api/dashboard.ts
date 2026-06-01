import type { DashboardData } from '../../api/types';
import data from '../data/dashboard.json';
import { delay } from './delay';

export async function getMockDashboard(): Promise<DashboardData> {
  await delay();
  return data as unknown as DashboardData;
}
