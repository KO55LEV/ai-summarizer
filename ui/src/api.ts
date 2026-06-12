import type { AnalyzeRequest, TranscriptInsightActionKey, TranscriptInsightScheduleResponse, TranscriptScheduleResponse, TranscriptResponse, WorkflowResponse, WorkflowStepResponse } from './types';

const API_BASE = '/api';

export async function analyzeVideo(request: AnalyzeRequest): Promise<TranscriptScheduleResponse> {
  const response = await fetch(`${API_BASE}/transcripts/youtube/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedByUserId: request.requestedByUserId ?? null,
      projectId: request.projectId ?? null,
      youtubeUrl: request.youtubeUrl,
      language: request.language,
      preferNativeTranscript: request.preferNativeTranscript ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Something went wrong' }));
    throw new Error(error.detail || `Request failed (${response.status})`);
  }

  return response.json();
}

export async function getWorkflowStatus(workflowId: string) {
  const response = await fetch(`${API_BASE}/workflows/${workflowId}`);
  if (!response.ok) throw new Error(`Failed to fetch workflow status`);
  return response.json() as Promise<WorkflowResponse>;
}

export async function getWorkflowSteps(workflowId: string) {
  const response = await fetch(`${API_BASE}/workflows/${workflowId}/steps`);
  if (!response.ok) throw new Error(`Failed to fetch workflow steps`);
  return response.json() as Promise<WorkflowStepResponse[]>;
}

export async function getTranscriptBySource(sourceId: string) {
  const response = await fetch(`${API_BASE}/transcripts/source/${sourceId}`);
  if (!response.ok) throw new Error(`Failed to fetch transcript`);
  return response.json() as Promise<TranscriptResponse>;
}

export async function getTranscriptInsightHistory(sourceId: string) {
  const response = await fetch(`${API_BASE}/transcripts/source/${sourceId}/insights/history`);
  if (!response.ok) throw new Error(`Failed to fetch transcript insight history`);
  return response.json() as Promise<WorkflowResponse[]>;
}

export async function createTranscriptInsight(
  sourceId: string,
  request: {
    requestedByUserId?: string | null;
    actionKey: TranscriptInsightActionKey;
    question?: string | null;
    conversationContext?: string | null;
  },
): Promise<TranscriptInsightScheduleResponse> {
  const response = await fetch(`${API_BASE}/transcripts/source/${sourceId}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedByUserId: request.requestedByUserId ?? null,
      actionKey: request.actionKey,
      question: request.question ?? null,
      conversationContext: request.conversationContext ?? null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Something went wrong' }));
    throw new Error(error.detail || `Request failed (${response.status})`);
  }

  return response.json() as Promise<TranscriptInsightScheduleResponse>;
}
