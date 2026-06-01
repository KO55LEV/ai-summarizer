export type NavItem = 'dashboard' | 'summarizer' | 'transcript' | 'insights' | 'exports' | 'history' | 'settings' | 'profile' | 'research';

export interface VideoRecord {
  title: string;
  channel: string;
  duration: string;
  language: string;
  quality: string;
  views: string;
  age: string;
  url: string;
  thumbnail: string;
  source: string;
}

export interface WorkflowResponse {
  id: string;
  requestedByUserId: string | null;
  sourceId: string | null;
  workflowType: string;
  status: string;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  currentStepKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  progressPercent: number | null;
  progressMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptResponse {
  id: string;
  sourceUrl: string | null;
  language: string;
  durationSeconds: number;
  segmentCount: number;
  wordCount: number;
  characterCount: number;
  transcriptText: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptScheduleResponse {
  requestId: string;
  status: 'completed' | 'queued';
  transcript: TranscriptResponse | null;
  workflow: WorkflowResponse | null;
}

export interface AnalyzeRequest {
  youtubeUrl: string;
  language?: string;
  preferNativeTranscript?: boolean;
}
