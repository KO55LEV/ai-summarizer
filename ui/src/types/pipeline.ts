export interface PipelineStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'warning' | 'failed';
  time?: string;
  detail?: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { key: 'fetch', label: 'Video fetched', status: 'pending' },
  { key: 'captions', label: 'Checking captions', status: 'pending' },
  { key: 'no-transcript', label: 'No YouTube transcript found', status: 'pending', detail: 'Falling back to Whisper' },
  { key: 'extract-audio', label: 'Extracting audio', status: 'pending' },
  { key: 'whisper', label: 'Whisper transcribing', status: 'pending' },
  { key: 'language', label: 'Detecting language', status: 'pending' },
  { key: 'insights', label: 'Generating insights', status: 'pending' },
];

export interface LogEntry {
  time: string;
  message: string;
  status: 'success' | 'info' | 'warning' | 'error' | 'pending' | 'running';
}

export interface ProcessingState {
  steps: PipelineStep[];
  logs: LogEntry[];
  currentStepIndex: number;
  isComplete: boolean;
  videoMeta: {
    title: string;
    channel: string;
    views: string;
    age: string;
    duration: string;
    language: string;
    quality: string;
    thumbnail: string;
  };
  processingMeta: {
    transcriptSource: string;
    languageStatus: string;
    estimatedTime: string;
    jobId: string;
    model: string;
    mode: string;
    audioSource: string;
    files: string;
  };
}
