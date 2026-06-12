export type NavItem = 'dashboard' | 'summarizer' | 'transcript' | 'insights' | 'exports' | 'history' | 'research' | 'projects' | 'todo' | 'notes' | 'settings' | 'profile';

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

export interface VideoMetadata {
  title: string;
  channel: string;
  views: string;
  age: string;
  duration: string;
  language: string;
  quality: string;
  thumbnail: string;
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

export interface WorkflowStepResponse {
  id: string;
  workflowId: string;
  stepOrder: number;
  stepKey: string;
  stepType: string;
  jobId: string | null;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptResponse {
  id: string;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceFilePath: string | null;
  language: string;
  languageProbability: number;
  durationSeconds: number;
  segmentCount: number;
  wordCount: number;
  characterCount: number;
  transcriptFilePath: string;
  transcriptText: string;
  cleanText: string;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptInsightActionKey = 'quick-summary' | 'key-takeaways' | 'ask-this-video' | 'study-guide';

export interface TranscriptInsightScheduleResponse {
  status: string;
  actionKey: TranscriptInsightActionKey;
  promptKey: string;
  estimatedCredits: number;
  workflow: WorkflowResponse | null;
  result: Record<string, unknown> | null;
}

export interface TranscriptInsightState {
  actionKey: TranscriptInsightActionKey;
  status: string;
  promptKey: string;
  estimatedCredits: number;
  workflowId: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
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
  requestedByUserId?: string | null;
  projectId?: string | null;
}
