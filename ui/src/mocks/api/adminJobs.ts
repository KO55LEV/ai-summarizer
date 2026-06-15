import { delay } from './delay';
import data from '../data/workflowCosts.json';
import type { JobResponse, JobLogResponse } from '../../api/adminJobs';

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

function makeLogs(jobId: string): JobLogResponse[] {
  const now = new Date('2026-06-15T10:00:00.000Z').toISOString();
  return [
    {
      id: `${jobId}-log-1`,
      jobId,
      attemptNo: 1,
      level: 'info',
      message: 'Job started.',
      context: { jobId },
      createdAt: now,
    },
    {
      id: `${jobId}-log-2`,
      jobId,
      attemptNo: 1,
      level: 'info',
      message: 'Processing step payload.',
      context: { jobId, phase: 'processing' },
      createdAt: now,
    },
    {
      id: `${jobId}-log-3`,
      jobId,
      attemptNo: 1,
      level: 'info',
      message: 'Job completed.',
      context: { jobId, status: 'succeeded' },
      createdAt: now,
    },
  ];
}

function toJobResponse(item: WorkflowCostDataFile['items'][number]): JobResponse {
  return {
    id: item.workflowId,
    parentJobId: null,
    requestedByUserId: item.requestedByUserId,
    jobType: item.workflowType,
    priority: 50,
    status: item.workflowStatus,
    payload: {
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      sourceType: item.sourceType,
      reason: item.reason,
    },
    result: item.workflowStatus === 'succeeded' ? { completed: true } : null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    errorDetails: item.errorMessage ? { message: item.errorMessage } : null,
    attemptCount: item.workflowStatus === 'running' ? 1 : 0,
    maxAttempts: 3,
    availableAt: item.createdAt,
    lockedBy: item.workflowStatus === 'running' ? 'mock-worker' : null,
    lockedAt: item.startedAt,
    lockedUntil: item.workflowStatus === 'running' ? item.finishedAt : null,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
    lastErrorAt: item.errorMessage ? item.finishedAt ?? item.startedAt : null,
    heartbeatAt: item.workflowStatus === 'running' ? item.startedAt : null,
    progressPercent: item.workflowStatus === 'running' ? 65 : item.workflowStatus === 'succeeded' ? 100 : null,
    progressMessage: item.workflowStatus === 'running' ? 'Processing' : item.workflowStatus === 'succeeded' ? 'Completed' : null,
    cancelRequestedAt: null,
    createdAt: item.createdAt,
    updatedAt: item.finishedAt ?? item.startedAt ?? item.createdAt,
  };
}

export async function getMockActiveJobs(limit = 50, offset = 0): Promise<JobResponse[]> {
  await delay();
  const active = state.items.filter((item) => ['queued', 'running', 'waiting'].includes(item.workflowStatus));
  return clone(active.slice(offset, offset + limit).map(toJobResponse));
}

export async function getMockHistoryJobs(limit = 50, offset = 0): Promise<JobResponse[]> {
  await delay();
  const history = state.items.filter((item) => !['queued', 'running', 'waiting'].includes(item.workflowStatus));
  return clone(history.slice(offset, offset + limit).map(toJobResponse));
}

export async function getMockJobLogs(jobId: string, limit = 100, offset = 0): Promise<JobLogResponse[]> {
  await delay();
  return makeLogs(jobId).slice(offset, offset + limit);
}

export async function requestMockJobCancel(_jobId: string): Promise<boolean> {
  await delay();
  return true;
}
