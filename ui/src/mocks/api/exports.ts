import type { ExportRecord } from '../../api/types';
import data from '../data/exports.json';
import { delay } from './delay';

export async function getMockExports(): Promise<ExportRecord[]> {
  await delay();
  return (data as { items: unknown[] }).items as ExportRecord[];
}
