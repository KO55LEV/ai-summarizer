import { useState, useEffect, useCallback, useRef } from 'react';
import type { PipelineStep, LogEntry, ProcessingState } from '../types/pipeline';
import { PIPELINE_STEPS } from '../types/pipeline';

const FAKE_VIDEO = {
  title: 'Mars: The Next Frontier – Inside SpaceX\'s Plan to Colonize the Red Planet',
  channel: 'Cosmic Future',
  views: '1.2M views',
  age: '2 months ago',
  duration: '22:47',
  language: 'EN',
  quality: '1080p',
  thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
};

const STEP_TIMINGS = [
  { duration: 2000, logMsg: 'Video fetched successfully', logStatus: 'success' as const },
  { duration: 3000, logMsg: 'Checking YouTube captions...', logStatus: 'info' as const },
  { duration: 2000, logMsg: 'No YouTube transcript available', logStatus: 'warning' as const },
  { duration: 3000, logMsg: 'Extracting audio stream...', logStatus: 'running' as const },
  { duration: 8000, logMsg: 'Whisper transcribing...', logStatus: 'running' as const },
  { duration: 3000, logMsg: 'Detecting language...', logStatus: 'info' as const },
  { duration: 4000, logMsg: 'Generating insights...', logStatus: 'running' as const },
];

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function elapsed(startMs: number) {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function useProcessingSimulation() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [state, setState] = useState<ProcessingState | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef(0);

  const startAnalysis = useCallback((url: string) => {
    cancelledRef.current = false;
    startTimeRef.current = Date.now();
    const steps: PipelineStep[] = PIPELINE_STEPS.map(s => ({ ...s }));
    const _url = url; // capture
    void _url;

    setState({
      steps,
      logs: [],
      currentStepIndex: -1,
      isComplete: false,
      videoMeta: FAKE_VIDEO,
      processingMeta: {
        transcriptSource: 'Checking...',
        languageStatus: 'Pending',
        estimatedTime: '~ 03:00',
        jobId: `job_${crypto.randomUUID().slice(0, 16).toUpperCase()}`,
        model: 'Whisper Large-v3 (OpenAI)',
        mode: 'Fallback transcription',
        audioSource: 'YouTube audio stream',
        files: 'Temporary • Auto-deleted',
      },
    });
    setIsAnalyzing(true);
  }, []);

  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true;
    setIsAnalyzing(false);
    setState(null);
  }, []);

  useEffect(() => {
    if (!isAnalyzing || !state) return;

    let stepIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advanceStep = () => {
      if (cancelledRef.current || stepIndex >= STEP_TIMINGS.length) {
        if (!cancelledRef.current) {
          setState(prev => prev ? { ...prev, isComplete: true } : prev);
        }
        return;
      }

      const i = stepIndex;
      const timing = STEP_TIMINGS[i];

      // Mark current step as running
      setState(prev => {
        if (!prev) return prev;
        const steps = prev.steps.map((s, idx) => {
          if (idx === i) return { ...s, status: 'running' as const, time: elapsed(startTimeRef.current) };
          return s;
        });
        const logs = [...prev.logs, {
          time: now(),
          message: timing.logMsg,
          status: timing.logStatus,
        }];
        return {
          ...prev,
          steps,
          logs,
          currentStepIndex: i,
          processingMeta: {
            ...prev.processingMeta,
            ...(i === 2 ? { transcriptSource: 'Whisper (fallback)' } : {}),
            ...(i === 5 ? { languageStatus: 'Detecting...' } : {}),
            ...(i === 6 ? { languageStatus: 'EN (English)' } : {}),
            estimatedTime: `~ ${String(Math.max(0, Math.floor((25000 - (Date.now() - startTimeRef.current)) / 60000))).padStart(2, '0')}:${String(Math.max(0, Math.floor(((25000 - (Date.now() - startTimeRef.current)) % 60000) / 1000))).padStart(2, '0')}`,
          },
        };
      });

      timeoutId = setTimeout(() => {
        // Mark step completed
        setState(prev => {
          if (!prev) return prev;
          const steps = prev.steps.map((s, idx) => {
            if (idx === i) {
              return {
                ...s,
                status: (i === 2 ? 'warning' : 'completed') as PipelineStep['status'],
                time: elapsed(startTimeRef.current),
              };
            }
            return s;
          });
          return { ...prev, steps };
        });

        stepIndex++;
        advanceStep();
      }, timing.duration);
    };

    // Start first step after a brief delay
    timeoutId = setTimeout(advanceStep, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing]);

  return { isAnalyzing, state, startAnalysis, cancelAnalysis };
}
