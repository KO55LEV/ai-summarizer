import data from '../data/workflowCosts.json';
import { delay } from './delay';
import type { WorkflowResponse } from '../../types';
import type { WorkflowEventResponse } from '../../api/adminWorkflows';
import type { WorkflowStepResponse } from '../../types';

type WorkflowCostDataFile = {
  items: Array<{
    workflowId: string;
    requestedByUserId: string | null;
    requestedByUserEmail: string | null;
    requestedByUserDisplayName: string | null;
    workflowType: string;
    workflowStatus: string;
    sourceId: string | null;
    sourceLabel: string | null;
    sourceType: string | null;
    reason: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  }>;
};

const state = structuredClone(data) as WorkflowCostDataFile;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toWorkflowResponse(item: WorkflowCostDataFile['items'][number]): WorkflowResponse {
  return {
    id: item.workflowId,
    requestedByUserId: item.requestedByUserId,
    sourceId: item.sourceId,
    workflowType: item.workflowType,
    status: item.workflowStatus,
    input: {
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      sourceType: item.sourceType,
      reason: item.reason,
    },
    result: null,
    currentStepKey: item.workflowStatus === 'running' ? 'processing' : null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    attemptCount: item.workflowStatus === 'running' ? 1 : 0,
    maxAttempts: 3,
    availableAt: item.createdAt,
    lockedBy: item.workflowStatus === 'running' ? 'worker-1' : null,
    lockedAt: item.startedAt,
    lockedUntil: item.workflowStatus === 'running' ? item.finishedAt : null,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
    heartbeatAt: item.workflowStatus === 'running' ? item.startedAt : null,
    progressPercent: item.workflowStatus === 'running' ? 65 : null,
    progressMessage: item.workflowStatus === 'running' ? 'Processing' : null,
    createdAt: item.createdAt,
    updatedAt: item.finishedAt ?? item.startedAt ?? item.createdAt,
  };
}

export async function getMockActiveWorkflows(limit = 50, offset = 0): Promise<WorkflowResponse[]> {
  await delay();
  const active = state.items.filter((item) => ['queued', 'running', 'waiting'].includes(item.workflowStatus));
  return clone(active.slice(offset, offset + limit).map(toWorkflowResponse));
}

export async function getMockHistoryWorkflows(limit = 50, offset = 0): Promise<WorkflowResponse[]> {
  await delay();
  const history = state.items.filter((item) => !['queued', 'running', 'waiting'].includes(item.workflowStatus));
  return clone(history.slice(offset, offset + limit).map(toWorkflowResponse));
}

export async function getMockWorkflowEvents(workflowId: string, limit = 100, offset = 0): Promise<WorkflowEventResponse[]> {
  await delay();
  const workflow = state.items.find((item) => item.workflowId === workflowId);
  if (!workflow) {
    return [];
  }

  const events: WorkflowEventResponse[] = [
    {
      id: `${workflowId}-event-1`,
      workflowId,
      stepKey: null,
      level: 'info',
      message: 'Workflow queued.',
      context: { status: workflow.workflowStatus },
      createdAt: workflow.createdAt,
    },
    {
      id: `${workflowId}-event-2`,
      workflowId,
      stepKey: 'execute',
      level: workflow.workflowStatus === 'failed' ? 'error' : 'info',
      message: workflow.workflowStatus === 'failed' ? 'Workflow failed.' : 'Workflow started.',
      context: { workflowType: workflow.workflowType, sourceId: workflow.sourceId },
      createdAt: workflow.startedAt ?? workflow.createdAt,
    },
  ];

  if (workflow.workflowStatus === 'running') {
    events.push({
      id: `${workflowId}-event-3`,
      workflowId,
      stepKey: 'execute',
      level: 'info',
      message: 'Workflow still running.',
      context: { progress: 'running' },
      createdAt: workflow.startedAt ?? workflow.createdAt,
    });
  } else if (workflow.workflowStatus === 'succeeded') {
    events.push({
      id: `${workflowId}-event-3`,
      workflowId,
      stepKey: 'complete',
      level: 'info',
      message: 'Workflow completed successfully.',
      context: { status: 'succeeded' },
      createdAt: workflow.finishedAt ?? workflow.createdAt,
    });
  } else if (workflow.workflowStatus === 'failed') {
    events.push({
      id: `${workflowId}-event-3`,
      workflowId,
      stepKey: 'complete',
      level: 'error',
      message: workflow.errorMessage ?? 'Workflow failed.',
      context: { errorCode: workflow.errorCode },
      createdAt: workflow.finishedAt ?? workflow.createdAt,
    });
  }

  return clone(events.slice(offset, offset + limit));
}

export async function getMockWorkflowSteps(workflowId: string): Promise<WorkflowStepResponse[]> {
  await delay();
  const workflow = state.items.find((item) => item.workflowId === workflowId);
  if (!workflow) {
    return [];
  }

  const base = workflow.workflowStatus === 'running' ? 'running' : workflow.workflowStatus === 'failed' ? 'failed' : 'succeeded';
  return clone([
    {
      id: `${workflowId}-step-1`,
      workflowId,
      stepOrder: 0,
      stepKey: 'start',
      stepType: 'workflow.start',
      jobId: `${workflowId}-job-1`,
      status: 'succeeded',
      input: { workflowId },
      output: { ok: true },
      errorCode: null,
      errorMessage: null,
      startedAt: workflow.startedAt,
      finishedAt: workflow.startedAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.startedAt ?? workflow.createdAt,
    },
    {
      id: `${workflowId}-step-2`,
      workflowId,
      stepOrder: 1,
      stepKey: base === 'running' ? 'processing' : 'complete',
      stepType: base === 'running' ? 'job.processing' : 'job.complete',
      jobId: `${workflowId}-job-2`,
      status: base,
      input: { workflowId },
      output: base === 'failed' ? null : { ok: true },
      errorCode: base === 'failed' ? 'job_failed' : null,
      errorMessage: base === 'failed' ? 'Step failed.' : null,
      startedAt: workflow.startedAt ?? workflow.createdAt,
      finishedAt: workflow.finishedAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.finishedAt ?? workflow.startedAt ?? workflow.createdAt,
    },
  ]);
}
