import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  Link as LinkIcon,
  Copy,
  Search,
  Globe,
  Edit3,
  ChevronDown,
  BookOpen,
  Sparkles,
  Star,
  MessageCircle,
  MessageSquareText,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';
import { getTranscriptInsightHistory } from '../api';
import type { TranscriptInsightActionKey, TranscriptInsightState, TranscriptResponse, VideoMetadata, WorkflowResponse } from '../types';

interface BackendTranscriptViewProps {
  url: string;
  transcript: TranscriptResponse;
  videoMeta: VideoMetadata;
  onChangeUrl: () => void;
  insightState?: TranscriptInsightState | null;
  onRequestInsight?: (actionKey: TranscriptInsightActionKey, question?: string | null, conversationContext?: string | null) => void;
  activeInsightTab?: InsightTab;
  onInsightTabChange?: (tab: InsightTab) => void;
  billingBalance?: {
    balanceCredits: number;
    reservedCredits: number;
    availableCredits: number;
  } | null;
  billingBalanceLoading?: boolean;
  billingBalanceError?: string | null;
}

type InsightTab = TranscriptInsightActionKey;
type TranscriptTab = 'transcript' | 'chapters' | 'notes';
type ViewTab = TranscriptTab | InsightTab;
type TranscriptViewMode = 'transcript' | 'clean';

type ChapterItem = {
  title: string;
  startLabel: string;
  endLabel: string;
  summary: string;
};

type QuoteItem = {
  quote: string;
  timestamp: string;
  note: string;
};

type InsightHistoryItem = WorkflowResponse;

const INSIGHT_TABS: Array<{
  key: InsightTab;
  label: string;
  description: string;
  icon: ReactNode;
  credits: number;
}> = [
  {
    key: 'quick-summary',
    label: 'Quick Summary',
    description: 'Concise overview with key points.',
    icon: <Sparkles size={13} />,
    credits: 10,
  },
  {
    key: 'key-takeaways',
    label: 'Key Takeaways',
    description: 'Main points and evidence.',
    icon: <Star size={13} />,
    credits: 10,
  },
  {
    key: 'ask-this-video',
    label: 'Ask this video',
    description: 'Question and answer from transcript.',
    icon: <MessageCircle size={13} />,
    credits: 10,
  },
  {
    key: 'study-guide',
    label: 'Study Guide',
    description: 'Flashcards, quiz, and review.',
    icon: <BookOpen size={13} />,
    credits: 10,
  },
];

const VIEW_TABS: Array<{
  key: ViewTab;
  label: string;
  description?: string;
}> = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'chapters', label: 'Chapters' },
  { key: 'notes', label: 'Notes' },
  { key: 'quick-summary', label: 'Quick Summary', description: 'Concise overview with key points.' },
  { key: 'key-takeaways', label: 'Key Takeaways', description: 'Main points and evidence.' },
  { key: 'ask-this-video', label: 'Ask this video', description: 'Question and answer from transcript.' },
  { key: 'study-guide', label: 'Study Guide', description: 'Flashcards, quiz, and review.' },
];

function isInsightTab(tab: ViewTab): tab is InsightTab {
  return tab === 'quick-summary' || tab === 'key-takeaways' || tab === 'ask-this-video' || tab === 'study-guide';
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTranscriptLines(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function formatRunTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function workflowTypeToInsightActionKey(workflowType: string): InsightTab | null {
  switch (workflowType) {
    case 'youtube.summary.quick_summary':
      return 'quick-summary';
    case 'youtube.summary.key_takeaways':
      return 'key-takeaways';
    case 'youtube.summary.ask_this_video':
      return 'ask-this-video';
    case 'youtube.summary.study_guide':
      return 'study-guide';
    default:
      return null;
  }
}

function makeApproxTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickTitle(lines: string[]): string {
  const words = new Map<string, number>();
  for (const line of lines) {
    for (const word of line.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
      if (word.length < 4) continue;
      words.set(word, (words.get(word) ?? 0) + 1);
    }
  }

  const best = [...words.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (best) {
    return best.charAt(0).toUpperCase() + best.slice(1);
  }

  const firstLine = lines[0] ?? 'Topic';
  return firstLine.slice(0, 42).replace(/\s+/g, ' ').replace(/[.?!:]$/, '') || 'Topic';
}

function buildApproxChapters(lines: string[], durationSeconds: number, count = 4): ChapterItem[] {
  if (lines.length === 0) return [];

  const chunks: string[][] = [];
  const chunkSize = Math.max(1, Math.ceil(lines.length / count));
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }

  const totalSeconds = Math.max(durationSeconds, chunks.length * 60);
  return chunks.slice(0, count).map((chunk, index) => {
    const startRatio = index / chunks.length;
    const endRatio = (index + 1) / chunks.length;
    const startSeconds = totalSeconds * startRatio;
    const endSeconds = totalSeconds * endRatio;
    const sentences = splitSentences(chunk.join(' ')).slice(0, 2);
    return {
      title: `${String(index + 1).padStart(2, '0')}. ${pickTitle(chunk)}`,
      startLabel: makeApproxTimestamp(startSeconds),
      endLabel: makeApproxTimestamp(endSeconds),
      summary: sentences.join(' ').slice(0, 220) || chunk[0] || 'No summary available.',
    };
  });
}

function buildKeyQuotes(lines: string[], durationSeconds: number, count = 5): QuoteItem[] {
  if (lines.length === 0) return [];

  const scored = lines
    .map((line, index) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      const lower = line.toLowerCase();
      let score = 0;
      if (words.length >= 8 && words.length <= 26) score += 2;
      if (/[0-9]/.test(line)) score += 2;
      if (/["'“”]/.test(line)) score += 1;
      if (/[A-Z]{2,}/.test(line)) score += 1;
      if (/\b(important|note|remember|key|should|must|because|therefore|however|always|never)\b/i.test(line)) score += 1;
      if (lower.includes('i think') || lower.includes('in other words')) score += 1;
      return { line, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count);

  const totalSeconds = Math.max(durationSeconds, scored.length * 60);
  return scored.map((item) => {
    const timestamp = makeApproxTimestamp(totalSeconds * (item.index / Math.max(1, lines.length)));
    return {
      quote: item.line,
      timestamp,
      note: 'Notable line',
    };
  });
}

function renderInsightResult(actionKey: InsightTab, result: Record<string, unknown>) {
  if (actionKey === 'quick-summary') {
    const summary = typeof result.summary === 'string' ? result.summary : null;
    const oneSentence = typeof result.oneSentence === 'string' ? result.oneSentence : null;
    const bullets = toStringArray(result.bullets);
    const confidence = typeof result.confidence === 'string' ? result.confidence : null;

    return (
      <div className="space-y-3">
        {summary && <p className="text-[13px] leading-relaxed text-text-secondary">{summary}</p>}
        {oneSentence && <div className="rounded-lg border border-border bg-bg-input/50 px-3 py-2 text-[12px] text-text-primary">{oneSentence}</div>}
        {bullets.length > 0 && (
          <ul className="space-y-2">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-[12px] text-text-secondary">
                <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {confidence && (
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
            Confidence: {confidence}
          </div>
        )}
      </div>
    );
  }

  if (actionKey === 'key-takeaways') {
    const summary = typeof result.summary === 'string' ? result.summary : null;
    const takeaways = Array.isArray(result.takeaways) ? result.takeaways.filter(isRecord) : [];

    return (
      <div className="space-y-3">
        {summary && <p className="text-[13px] leading-relaxed text-text-secondary">{summary}</p>}
        <div className="space-y-2">
          {takeaways.map((item, index) => (
            <div key={`${index}-${typeof item.point === 'string' ? item.point : 'takeaway'}`} className="rounded-lg border border-border bg-bg-input/40 px-3 py-2">
              <div className="text-[12px] font-medium text-text-primary">
                {typeof item.point === 'string' ? item.point : 'Takeaway'}
              </div>
              {typeof item.evidence === 'string' && (
                <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{item.evidence}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (actionKey === 'ask-this-video') {
    const answer = typeof result.answer === 'string' ? result.answer : null;
    const evidence = Array.isArray(result.supportingEvidence) ? result.supportingEvidence.filter(isRecord) : [];
    const followUps = toStringArray(result.followUpQuestions);

    return (
      <div className="space-y-3">
        {answer && <p className="text-[13px] leading-relaxed text-text-secondary">{answer}</p>}
        {evidence.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Evidence</div>
            {evidence.slice(0, 3).map((item, index) => (
              <div key={`${index}-${typeof item.quote === 'string' ? item.quote : 'evidence'}`} className="rounded-lg border border-border bg-bg-input/40 px-3 py-2 text-[12px] text-text-secondary">
                {typeof item.quote === 'string' ? item.quote : ''}
              </div>
            ))}
          </div>
        )}
        {followUps.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Follow-up questions</div>
            <ul className="space-y-1.5">
              {followUps.slice(0, 4).map((item) => (
                <li key={item} className="text-[12px] text-text-secondary">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (actionKey === 'study-guide') {
    const overview = typeof result.overview === 'string' ? result.overview : null;
    const keyTerms = toObjectArray(result.keyTerms);
    const flashcards = toObjectArray(result.flashcards);
    const quiz = toObjectArray(result.quiz);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Terms</div>
            <div className="mt-1 text-[16px] font-semibold text-text-primary">{keyTerms.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Flashcards</div>
            <div className="mt-1 text-[16px] font-semibold text-text-primary">{flashcards.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-input/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Quiz</div>
            <div className="mt-1 text-[16px] font-semibold text-text-primary">{quiz.length}</div>
          </div>
        </div>

        {overview && (
          <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Review Overview</div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{overview}</p>
          </div>
        )}

        {keyTerms.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Key Terms</div>
            <div className="grid gap-2">
              {keyTerms.slice(0, 8).map((item, index) => {
                const term = typeof item.term === 'string' ? item.term : `Term ${index + 1}`;
                const definition = typeof item.definition === 'string' ? item.definition : 'Definition not provided.';
                return (
                  <div key={`${term}-${index}`} className="rounded-xl border border-border bg-bg-input/35 px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-text-primary">{term}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">{definition}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {flashcards.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Flashcards</div>
            <div className="grid gap-2">
              {flashcards.slice(0, 6).map((item, index) => {
                const front = typeof item.front === 'string' ? item.front : `Card ${index + 1}`;
                const back = typeof item.back === 'string' ? item.back : 'No back side provided.';
                return (
                  <div key={`${front}-${index}`} className="rounded-xl border border-border bg-bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Front</div>
                    <div className="mt-1 text-[13px] font-medium text-text-primary">{front}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-text-muted">Back</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">{back}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {quiz.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Quiz</div>
            <div className="grid gap-2">
              {quiz.slice(0, 5).map((item, index) => {
                const question = typeof item.question === 'string' ? item.question : `Question ${index + 1}`;
                const choices = toStringArray(item.choices);
                const answerIndex = typeof item.answerIndex === 'number' ? item.answerIndex : -1;
                const explanation = typeof item.explanation === 'string' ? item.explanation : 'No explanation provided.';
                return (
                  <div key={`${question}-${index}`} className="rounded-xl border border-border bg-bg-input/35 px-3 py-2.5">
                    <div className="text-[13px] font-semibold text-text-primary">{question}</div>
                    {choices.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {choices.map((choice, choiceIndex) => (
                          <div
                            key={`${choice}-${choiceIndex}`}
                            className={`rounded-lg px-2.5 py-2 text-[12px] ${
                              choiceIndex === answerIndex ? 'border border-accent/30 bg-accent/10 text-text-primary' : 'border border-border bg-bg-card text-text-secondary'
                            }`}
                          >
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + choiceIndex)}.</span>
                            {choice}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{explanation}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <pre className="max-h-[240px] overflow-auto rounded-lg border border-border bg-bg-input/40 p-3 text-[11px] leading-relaxed text-text-secondary">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    confidence?: string | null;
    evidence?: string[];
    limitations?: string[];
  };
};

function formatAskResult(result: Record<string, unknown>): AskMessage['meta'] & { content: string } {
  const answer = typeof result.answer === 'string' ? result.answer : 'No answer returned.';
  const confidence = typeof result.confidence === 'string' ? result.confidence : null;
  const evidence = Array.isArray(result.supportingEvidence)
    ? result.supportingEvidence
        .filter(isRecord)
        .map((item) => (typeof item.quote === 'string' ? item.quote : null))
        .filter((item): item is string => Boolean(item))
        .slice(0, 3)
    : [];
  const limitations = toStringArray(result.limitations).slice(0, 2);

  return {
    content: answer,
    confidence,
    evidence,
    limitations,
  };
}

export default function BackendTranscriptView({
  url,
  transcript,
  videoMeta,
  onChangeUrl,
  insightState,
  onRequestInsight,
  activeInsightTab: activeInsightTabProp,
  onInsightTabChange,
  billingBalance,
  billingBalanceLoading,
  billingBalanceError,
}: BackendTranscriptViewProps) {
  const [activeTranscriptTab, setActiveTranscriptTab] = useState<ViewTab>('transcript');
  const [transcriptViewMode, setTranscriptViewMode] = useState<TranscriptViewMode>('transcript');
  const [activeInsightTabLocal, setActiveInsightTabLocal] = useState<InsightTab>('quick-summary');
  const [askQuestion, setAskQuestion] = useState('');
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const [askPendingQuestion, setAskPendingQuestion] = useState<string | null>(null);
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([]);
  const [insightHistoryLoading, setInsightHistoryLoading] = useState(false);
  const [insightHistoryError, setInsightHistoryError] = useState<string | null>(null);
  const [selectedInsightHistoryId, setSelectedInsightHistoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const lastHandledAskWorkflowIdRef = useRef<string | null>(null);

  const transcriptLines = formatTranscriptLines(transcript.transcriptText);
  const filteredLines = searchQuery
    ? transcriptLines.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
    : transcriptLines;
  const transcriptChapters = buildApproxChapters(transcriptLines, transcript.durationSeconds, 4);
  const transcriptQuotes = buildKeyQuotes(transcriptLines, transcript.durationSeconds, 5);

  const transcriptSource = transcript.sourceFilePath ? 'Whisper transcript' : 'YouTube transcript';
  const transcriptSourceLabel = transcript.sourceFilePath ? 'Whisper fallback' : 'YouTube subtitles';

  const cleanText = transcript.cleanText ?? transcript.transcriptText;
  const activeTranscriptText = transcriptViewMode === 'clean' ? cleanText : transcript.transcriptText;

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(activeTranscriptText).catch(() => {});
  };

  useEffect(() => {
    if (insightState?.actionKey) {
      onInsightTabChange?.(insightState.actionKey);
    }
  }, [insightState?.actionKey, onInsightTabChange]);

  const activeInsightTab = activeInsightTabProp ?? activeInsightTabLocal;
  const setActiveInsightTab = (tab: InsightTab) => {
    setSelectedInsightHistoryId(null);
    if (onInsightTabChange) {
      onInsightTabChange(tab);
      return;
    }

    setActiveInsightTabLocal(tab);
  };

  useEffect(() => {
    if (activeInsightTabProp) {
      setSelectedInsightHistoryId(null);
      setActiveInsightTabLocal(activeInsightTabProp);
      setActiveTranscriptTab(activeInsightTabProp);
    }
  }, [activeInsightTabProp]);

  useEffect(() => {
    const sourceId = transcript.sourceId;
    if (!sourceId) {
      setInsightHistory([]);
      setInsightHistoryError(null);
      setInsightHistoryLoading(false);
      setSelectedInsightHistoryId(null);
      return;
    }

    let cancelled = false;
    setInsightHistoryLoading(true);
    setInsightHistoryError(null);
    setSelectedInsightHistoryId(null);

    getTranscriptInsightHistory(sourceId)
      .then((items) => {
        if (cancelled) return;
        setInsightHistory(items);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInsightHistory([]);
        setInsightHistoryError(error instanceof Error ? error.message : 'Failed to load insight history');
      })
      .finally(() => {
        if (!cancelled) setInsightHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transcript.sourceId]);

  useEffect(() => {
    if (activeInsightTab !== 'ask-this-video') {
      return;
    }

    if (insightState?.actionKey !== 'ask-this-video') {
      return;
    }

    if (insightState.status !== 'succeeded' || !insightState.workflowId) {
      return;
    }

    if (lastHandledAskWorkflowIdRef.current === insightState.workflowId) {
      return;
    }

    lastHandledAskWorkflowIdRef.current = insightState.workflowId;

    const result = insightState.result;
    if (!result) {
      return;
    }

    const formatted = formatAskResult(result);
    setAskMessages((current) => [
      ...current,
      {
        id: `assistant-${insightState.workflowId}`,
        role: 'assistant',
        content: formatted.content,
        meta: {
          confidence: formatted.confidence,
          evidence: formatted.evidence,
          limitations: formatted.limitations,
        },
      },
    ]);
    setAskPendingQuestion(null);
  }, [activeInsightTab, insightState]);

  useEffect(() => {
    if (!insightState || insightState.actionKey !== activeInsightTab || insightState.status !== 'succeeded' || !insightState.workflowId) {
      return;
    }

    const workflowId = insightState.workflowId;
    const sourceId = transcript.sourceId ?? null;
    const actionKey = insightState.actionKey;

    setInsightHistory((current) => {
      if (current.some((item) => item.id === workflowId)) {
        return current;
      }

      const workflowTypeMap: Record<InsightTab, string> = {
        'quick-summary': 'youtube.summary.quick_summary',
        'key-takeaways': 'youtube.summary.key_takeaways',
        'ask-this-video': 'youtube.summary.ask_this_video',
        'study-guide': 'youtube.summary.study_guide',
      };

      const now = new Date().toISOString();
      const newItem: InsightHistoryItem = {
        id: workflowId,
        requestedByUserId: null,
        sourceId,
        workflowType: workflowTypeMap[actionKey],
        status: 'succeeded',
        input: {
          actionKey,
        },
        result: insightState.result,
        currentStepKey: null,
        errorCode: null,
        errorMessage: null,
        attemptCount: 1,
        maxAttempts: 1,
        startedAt: now,
        finishedAt: now,
        progressPercent: null,
        progressMessage: null,
        createdAt: now,
        updatedAt: now,
      };

      return [newItem, ...current];
    });
  }, [activeInsightTab, insightState, transcript.sourceId]);

  const activeInsightMeta = INSIGHT_TABS.find((tab) => tab.key === activeInsightTab) ?? INSIGHT_TABS[0];
  const busy = Boolean(insightState && (insightState.status === 'starting' || insightState.status === 'queued' || insightState.status === 'running' || insightState.status === 'waiting'));
  const currentResult = insightState?.actionKey === activeInsightTab ? insightState.result : null;
  const currentError = insightState?.actionKey === activeInsightTab ? insightState.error : null;
  const activeInsightHistoryItems = insightHistory.filter((item) => workflowTypeToInsightActionKey(item.workflowType) === activeInsightTab);
  const selectedInsightHistoryItem = selectedInsightHistoryId
    ? insightHistory.find((item) => item.id === selectedInsightHistoryId) ?? null
    : null;
  const defaultHistoryItem = activeInsightHistoryItems[0] ?? null;
  const visibleResult = selectedInsightHistoryItem?.result ?? currentResult ?? (!busy ? defaultHistoryItem?.result ?? null : null);
  const visibleError = selectedInsightHistoryItem ? null : currentError;
  const estimateCredits = insightState?.estimatedCredits ?? 10;
  const availableCredits = billingBalance?.availableCredits ?? null;
  const balanceSummary = billingBalance
    ? `${billingBalance.availableCredits} available · ${billingBalance.reservedCredits} reserved · ${billingBalance.balanceCredits} total`
    : billingBalanceError
      ? billingBalanceError
      : billingBalanceLoading
        ? 'Loading balance...'
        : 'Balance not loaded';

  const handleRunActiveInsight = () => {
    if (busy || !onRequestInsight) {
      return;
    }

    if (!isInsightTab(activeTranscriptTab)) {
      setActiveTranscriptTab(activeInsightTab);
    }
    setSelectedInsightHistoryId(null);
    onRequestInsight(activeInsightTab);
  };

  const handleAskSubmit = () => {
    const question = askQuestion.trim();
    if (!question || busy || !onRequestInsight) {
      return;
    }

    const lastAssistantMessage = [...askMessages].reverse().find((message) => message.role === 'assistant');
    const conversationContext = lastAssistantMessage
      ? `Previous answer: ${lastAssistantMessage.content.slice(0, 240)}`
      : null;

    setActiveInsightTab('ask-this-video');
    setActiveTranscriptTab('ask-this-video');
    setSelectedInsightHistoryId(null);
    setAskMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
      },
    ]);
    setAskPendingQuestion(question);
    setAskQuestion('');
    onRequestInsight('ask-this-video', question, conversationContext);
  };

  const handleAskClear = () => {
    setAskMessages([]);
    setAskPendingQuestion(null);
  };

  const renderInsightTabBody = () => {
    if (activeInsightTab === 'ask-this-video') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-card px-3 py-2.5">
            <div className="text-[11px] text-text-muted">
              Ask a follow-up. Keep it short for lower token usage.
            </div>
            <button
              type="button"
              onClick={handleAskClear}
              disabled={askMessages.length === 0}
              className="text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear chat
            </button>
          </div>

          <div className="max-h-[260px] space-y-3 overflow-y-auto rounded-xl border border-border bg-bg-card p-3">
            {askMessages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-bg-input/30 px-3 py-4 text-[12px] leading-relaxed text-text-secondary">
                Start with a focused question. The answer will stay short, and I only send a compact context window to the model.
              </div>
            )}
            {askMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-bg-input/40 text-text-secondary'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-[0.12em] opacity-70">
                    {message.role === 'user' ? 'You' : 'Answer'}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                  {message.meta?.confidence && (
                    <div className={`mt-2 text-[11px] ${message.role === 'user' ? 'text-white/80' : 'text-text-muted'}`}>
                      Confidence: {message.meta.confidence}
                    </div>
                  )}
                  {message.meta?.evidence && message.meta.evidence.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.meta.evidence.map((item) => (
                        <div key={item} className={`rounded-lg px-2 py-1 text-[11px] ${message.role === 'user' ? 'bg-white/10 text-white/80' : 'bg-bg-card text-text-muted'}`}>
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                  {message.meta?.limitations && message.meta.limitations.length > 0 && (
                    <div className={`mt-2 text-[11px] ${message.role === 'user' ? 'text-white/75' : 'text-text-muted'}`}>
                      {message.meta.limitations.join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && askPendingQuestion && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-accent/20 bg-accent/8 px-3 py-2.5 text-[13px] leading-relaxed text-text-secondary">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Assistant</div>
                  <div className="mt-1">Thinking about: {askPendingQuestion}</div>
                </div>
              </div>
            )}
            {!busy && currentError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-[12px] leading-relaxed text-text-muted">
                {currentError}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-3">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Your question
            </label>
            <textarea
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-bg-input/50 px-3 py-2.5 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
              placeholder="Ask something specific about the video"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-text-muted">
                Estimated cost: {estimateCredits} credits
              </div>
              <button
                type="button"
                onClick={handleAskSubmit}
                disabled={busy || !askQuestion.trim() || !onRequestInsight}
                className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeInsightTab === 'study-guide') {
      return (
        <div className="space-y-4">
          {busy && insightState && insightState.actionKey === activeInsightTab && (
            <div className="mb-2 rounded-xl border border-accent/20 bg-accent/8 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                <Sparkles size={12} className="text-accent" />
                Generating {activeInsightMeta.label}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                Estimated cost: {insightState.estimatedCredits} credits
              </div>
            </div>
          )}
          {!visibleResult && !busy && !visibleError && (
            <div className="rounded-xl border border-border bg-bg-card px-4 py-4 text-[13px] leading-relaxed text-text-secondary">
              Generate this insight to see the result here.
            </div>
          )}
          {visibleResult && (
            <div className="rounded-xl border border-border bg-bg-card px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                    {selectedInsightHistoryItem ? 'Saved result' : 'Latest result'}
                  </div>
                  <div className="mt-1 text-[12px] text-text-muted">
                    {selectedInsightHistoryItem
                      ? `Run ${selectedInsightHistoryItem.id.slice(0, 8)} · ${formatRunTimestamp(selectedInsightHistoryItem.createdAt)}`
                      : 'This is the most recent run for the active tab.'}
                  </div>
                </div>
                {selectedInsightHistoryItem && (
                  <button
                    type="button"
                    onClick={() => setSelectedInsightHistoryId(null)}
                    className="rounded-lg border border-border bg-bg-input/40 px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Back to latest
                  </button>
                )}
              </div>
              {renderInsightResult(activeInsightTab, visibleResult)}
            </div>
          )}
          <div className="mt-4 rounded-xl border border-border bg-bg-input/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Previous runs</div>
                <div className="mt-1 text-[12px] text-text-secondary">
                  Reopen a previously generated result without spending credits again.
                </div>
              </div>
              <div className="text-[11px] text-text-muted">
                {insightHistoryLoading ? 'Loading…' : `${activeInsightHistoryItems.length} saved`}
              </div>
            </div>

            {insightHistoryError && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[12px] leading-relaxed text-text-muted">
                {insightHistoryError}
              </div>
            )}

            {!insightHistoryLoading && activeInsightHistoryItems.length === 0 && !insightHistoryError && (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-bg-card px-3 py-3 text-[12px] leading-relaxed text-text-secondary">
                No saved runs yet for this insight.
              </div>
            )}

            {activeInsightHistoryItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeInsightHistoryItems.map((item) => {
                  const isSelected = selectedInsightHistoryId === item.id;
                  const historyAction = workflowTypeToInsightActionKey(item.workflowType) ?? activeInsightTab;
                  const itemTitle = INSIGHT_TABS.find((tab) => tab.key === historyAction)?.label ?? 'Saved run';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedInsightHistoryId(item.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-bg-card hover:bg-bg-card-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-text-primary">{itemTitle}</div>
                          <div className="mt-0.5 text-[11px] text-text-muted">
                            {formatRunTimestamp(item.createdAt)} · {item.id.slice(0, 8)}
                          </div>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Open</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    const tabInstruction = activeInsightTab === 'quick-summary'
      ? 'Generate a concise summary of the video.'
      : 'Generate focused insight output for this video.';

    return (
      <div className="space-y-4">
        {busy && insightState && insightState.actionKey === activeInsightTab && (
          <div className="mb-2 rounded-xl border border-accent/20 bg-accent/8 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
              <Sparkles size={12} className="text-accent" />
              Generating {activeInsightMeta.label}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              Estimated cost: {insightState.estimatedCredits} credits
            </div>
          </div>
        )}

        {!busy && visibleError && !selectedInsightHistoryItem && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
              <ShieldAlert size={12} className="text-red-400" />
              Insight failed
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{visibleError}</div>
          </div>
        )}

        {!visibleResult && !busy && !visibleError && (
          <div className="rounded-xl border border-border bg-bg-card px-4 py-4 text-[13px] leading-relaxed text-text-secondary">
            {tabInstruction}
          </div>
        )}

        {visibleResult && (
          <div className="rounded-xl border border-border bg-bg-card px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  {selectedInsightHistoryItem ? 'Saved result' : 'Latest result'}
                </div>
                <div className="mt-1 text-[12px] text-text-muted">
                  {selectedInsightHistoryItem
                    ? `Run ${selectedInsightHistoryItem.id.slice(0, 8)} · ${formatRunTimestamp(selectedInsightHistoryItem.createdAt)}`
                    : 'This is the most recent run for the active tab.'}
                </div>
              </div>
              {selectedInsightHistoryItem && (
                <button
                  type="button"
                  onClick={() => setSelectedInsightHistoryId(null)}
                  className="rounded-lg border border-border bg-bg-input/40 px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Back to latest
                </button>
              )}
            </div>
            {renderInsightResult(activeInsightTab, visibleResult)}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-bg-input/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Previous runs</div>
                <div className="mt-1 text-[12px] text-text-secondary">
                  Reopen a previously generated result without spending credits again.
                </div>
              </div>
              <div className="text-[11px] text-text-muted">
                {insightHistoryLoading ? 'Loading…' : `${activeInsightHistoryItems.length} saved`}
              </div>
            </div>

            {insightHistoryError && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[12px] leading-relaxed text-text-muted">
                {insightHistoryError}
              </div>
            )}

            {!insightHistoryLoading && activeInsightHistoryItems.length === 0 && !insightHistoryError && (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-bg-card px-3 py-3 text-[12px] leading-relaxed text-text-secondary">
                No saved runs yet for this insight.
              </div>
            )}

            {activeInsightHistoryItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeInsightHistoryItems.map((item) => {
                  const isSelected = selectedInsightHistoryId === item.id;
                  const historyAction = workflowTypeToInsightActionKey(item.workflowType) ?? activeInsightTab;
                  const itemTitle = INSIGHT_TABS.find((tab) => tab.key === historyAction)?.label ?? 'Saved run';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedInsightHistoryId(item.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-bg-card hover:bg-bg-card-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-text-primary">{itemTitle}</div>
                          <div className="mt-0.5 text-[11px] text-text-muted">
                            {formatRunTimestamp(item.createdAt)} · {item.id.slice(0, 8)}
                          </div>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Open</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[920px] px-6 py-6 lg:px-10 lg:py-8">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent/20 border border-accent/40 flex-shrink-0">
              <Check size={16} className="text-accent" />
            </div>
            <h1 className="text-[26px] font-bold text-text-primary tracking-tight">Transcript ready</h1>
          </div>
          <p className="ml-11 text-[13px] text-text-secondary">
            The transcript is ready. Review the transcript first, then open the insights below when you want summary work.
          </p>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-bg-card px-4 py-3">
          <LinkIcon size={14} className="flex-shrink-0 text-text-muted" />
          <span className="flex-1 truncate text-[12px] text-text-secondary">{url}</span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-accent">Completed</span>
          </div>
          <div className="h-4 w-px flex-shrink-0 bg-border" />
          <button
            onClick={onChangeUrl}
            className="flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
          >
            <Edit3 size={12} />
            Change
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-bg-card p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
          <div className="flex gap-4">
            <div className="relative h-[112px] w-[200px] flex-shrink-0 overflow-hidden rounded-xl bg-bg-input">
              <img
                src={videoMeta.thumbnail}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {videoMeta.duration}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 text-[14px] font-semibold leading-snug text-text-primary">{videoMeta.title}</h3>
              <div className="mb-3 flex items-center gap-1.5">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-bg-input">
                  <span className="text-[8px] font-bold text-text-muted">YT</span>
                </div>
                <span className="text-[12px] text-text-secondary">{videoMeta.channel}</span>
                <span className="ml-1 text-[11px] text-text-muted">{transcriptSourceLabel}</span>
                <span className="text-[11px] text-text-muted">· {transcript.language.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-border bg-bg-input/40 px-3 py-1.5 text-[11px] text-text-muted">
                  {transcript.wordCount.toLocaleString()} words
                </div>
                <div className="rounded-full border border-border bg-bg-input/40 px-3 py-1.5 text-[11px] text-text-muted">
                  {transcript.segmentCount.toLocaleString()} segments
                </div>
                <div className="rounded-full border border-border bg-bg-input/40 px-3 py-1.5 text-[11px] text-text-muted">
                  {cleanText === transcript.transcriptText ? 'No separate clean text' : 'Clean text available'}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-0.5 text-[10px] text-text-muted">Duration</div>
                  <div className="text-[12px] font-medium text-text-primary">{formatDuration(transcript.durationSeconds)}</div>
                </div>
                <div>
                  <div className="mb-0.5 text-[10px] text-text-muted">Transcript source</div>
                  <div className="text-[12px] font-medium text-text-primary">{transcriptSource}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-border bg-bg-card p-6">
          <div className="pb-3">
            <div className="flex flex-wrap gap-6">
              {VIEW_TABS.map((tab) => {
                const active = activeTranscriptTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTranscriptTab(tab.key);
                      if (isInsightTab(tab.key)) {
                        setActiveInsightTab(tab.key);
                      }
                    }}
                    className={`relative pb-4 text-[13px] font-medium transition-colors ${
                      active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors ${
                        active ? 'bg-accent' : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {activeTranscriptTab === 'transcript' && (
            <>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                  <div className="inline-flex rounded-lg border border-border bg-bg-input/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setTranscriptViewMode('transcript')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        transcriptViewMode === 'transcript'
                          ? 'bg-accent text-white'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Transcript
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscriptViewMode('clean')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        transcriptViewMode === 'clean'
                          ? 'bg-accent text-white'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Clean text
                    </button>
                  </div>

                  {transcriptViewMode === 'transcript' && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-input px-2.5 py-1">
                      <Search size={11} className="text-text-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transcript"
                        className="w-[190px] bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-input/40 px-2 py-1">
                    <Globe size={11} className="text-text-muted" />
                    <span className="text-[11px] text-text-secondary">{transcript.language}</span>
                    <ChevronDown size={10} className="text-text-muted" />
                  </div>

                  {transcriptViewMode === 'clean' ? (
                    <div className="text-[10px] text-text-muted">
                      Cleaner reading view
                    </div>
                  ) : (
                    <div className="text-[10px] text-text-muted">
                      Showing {filteredLines.length.toLocaleString()} lines
                    </div>
                  )}

                  <div className="ml-0 lg:ml-auto">
                    <button
                      onClick={handleCopyTranscript}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-input/40 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary cursor-pointer"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {transcriptViewMode === 'transcript' ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-bg-card">
                  <div className="divide-y divide-border">
                    {filteredLines.map((line, i) => (
                      <div key={`${i}-${line.slice(0, 24)}`} className="group flex gap-4 px-5 py-3.5 transition-colors hover:bg-bg-input/50">
                        <div className="w-[38px] flex-shrink-0 font-mono text-[11px] font-medium text-accent">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <p className="flex-1 text-[12px] leading-relaxed text-text-secondary">{line}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-border bg-bg-input/25 p-5">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed font-sans text-text-secondary">
                    {activeTranscriptText}
                  </pre>
                </div>
              )}
            </>
          )}

          {activeTranscriptTab === 'chapters' && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-border bg-bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} className="text-accent" />
                  <span className="text-[13px] font-semibold text-text-primary">Chapters</span>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed">
                  Chapters are generated from the video text so you can jump through the structure quickly.
                </p>
              </div>

              <div className="space-y-2">
                {transcriptChapters.map((chapter) => (
                  <div key={`${chapter.title}-${chapter.startLabel}`} className="rounded-xl border border-border bg-bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-text-primary leading-tight">{chapter.title}</div>
                        <div className="mt-1 text-[11px] text-text-muted">
                          {chapter.startLabel} - {chapter.endLabel}
                        </div>
                      </div>
                      <div className="rounded-full border border-border bg-bg-input/50 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
                        Auto
                      </div>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{chapter.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTranscriptTab === 'notes' && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-border bg-bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareText size={14} className="text-accent" />
                  <span className="text-[13px] font-semibold text-text-primary">Notes</span>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed">
                  Important lines pulled directly from the video text.
                </p>
              </div>

              <div className="space-y-2">
                {transcriptQuotes.length > 0 ? transcriptQuotes.map((quote) => (
                  <div key={`${quote.timestamp}-${quote.quote.slice(0, 20)}`} className="rounded-xl border border-border bg-bg-card p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-accent">{quote.timestamp}</div>
                      <div className="text-[10px] text-text-muted">{quote.note}</div>
                    </div>
                    <p className="text-[13px] leading-relaxed text-text-secondary">“{quote.quote}”</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-border bg-bg-card p-4 text-[13px] leading-relaxed text-text-secondary">
                    No strong note candidates found yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {isInsightTab(activeTranscriptTab) && (
            <div className="mt-3 space-y-4">
              <div className="rounded-xl border border-border bg-bg-input/20 p-3 text-[11px] text-text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <CreditCard size={12} className="text-accent" />
                  <span className="uppercase tracking-[0.12em]">Credits</span>
                  <span className="text-text-secondary">{balanceSummary}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-bg-input/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {activeInsightMeta.icon}
                    <div>
                      <div className="text-[14px] font-semibold text-text-primary">{activeInsightMeta.label}</div>
                      <div className="text-[11px] text-text-muted">Estimated cost: {estimateCredits} credits</div>
                    </div>
                  </div>
                  {activeInsightTab !== 'ask-this-video' && (
                    <button
                      type="button"
                      onClick={handleRunActiveInsight}
                      disabled={busy || !onRequestInsight || (availableCredits !== null && availableCredits < estimateCredits)}
                      className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? 'Working…' : 'Run now'}
                    </button>
                  )}
                </div>

                {renderInsightTabBody()}
              </div>
            </div>
          )}

        </section>

      </div>
    </main>
  );
}
