import data from '../data/workflowCosts.json';
import { delay } from './delay';
import type { WorkflowCostResponse } from '../../api/adminWorkflowCosts';

type WorkflowCostDataFile = {
  items: WorkflowCostResponse[];
};

const state = structuredClone(data) as WorkflowCostDataFile;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function getMockWorkflowCosts(limit = 50, offset = 0): Promise<WorkflowCostResponse[]> {
  await delay();
  return clone(state.items.slice(offset, offset + limit));
}

export async function getMockWorkflowCostById(workflowId: string): Promise<WorkflowCostResponse> {
  await delay();
  const item = state.items.find((entry) => entry.workflowId === workflowId);
  if (!item) {
    throw new Error('Workflow cost not found');
  }

  return clone(item);
}
