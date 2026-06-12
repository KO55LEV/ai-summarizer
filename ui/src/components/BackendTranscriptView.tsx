import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  Link as LinkIcon,
  Copy,
  Download,
  Search,
  Globe,
  Edit3,
  ChevronDown,
  BookOpen,
  MessageSquareText,
  Sparkles,
  Star,
  MessageCircle,
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

type Tab = 'transcript' | 'clean' | 'chapters' | 'notes';
type InsightTab = TranscriptInsightActionKey;

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

type PendingInsightRequest = {
  actionKey: InsightTab;
  question: string | null;
  conversationContext: string | null;
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

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'your', 'have', 'will', 'about', 'they', 'their', 'there',
  'what', 'when', 'where', 'which', 'into', 'than', 'then', 'because', 'would', 'could', 'should', 'video', 'transcript',
  'like', 'just', 'you', 'are', 'was', 'were', 'been', 'being', 'but', 'not', 'can', 'all', 'our', 'out', 'one', 'two',
  'also', 'more', 'most', 'some', 'very', 'really', 'into', 'over', 'under', 'again', 'here', 'such', 'those', 'these',
]);

function pickTitle(lines: string[]): string {
  const words = new Map<string, number>();
  for (const line of lines) {
    for (const word of line.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
      if (word.length < 4 || STOPWORDS.has(word)) continue;
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
  return scored.map((item, position) => {
    const timestamp = makeApproxTimestamp(totalSeconds * (item.index / Math.max(1, lines.length)));
    return {
      quote: item.line,
      timestamp,
      note: position === 0 ? 'Most quotable line' : 'Notable line',
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
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [activeInsightTabLocal, setActiveInsightTabLocal] = useState<InsightTab>('quick-summary');
  const [askQuestion, setAskQuestion] = useState('');
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const [askPendingQuestion, setAskPendingQuestion] = useState<string | null>(null);
  const [pendingInsight, setPendingInsight] = useState<PendingInsightRequest | null>(null);
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([]);
  const [insightHistoryLoading, setInsightHistoryLoading] = useState(false);
  const [insightHistoryError, setInsightHistoryError] = useState<string | null>(null);
  const [selectedInsightHistoryId, setSelectedInsightHistoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const lastHandledAskWorkflowIdRef = useRef<string | null>(null);

  const transcriptLines = formatTranscriptLines(transcript.transcriptText);
  const filteredLines = searchQuery
    ? transcriptLines.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
    : transcriptLines;
  const chapters = buildApproxChapters(transcriptLines, transcript.durationSeconds, 4);
  const keyQuotes = buildKeyQuotes(transcriptLines, transcript.durationSeconds, 5);

  const transcriptSource = transcript.sourceFilePath ? 'Whisper transcript' : 'YouTube transcript';
  const transcriptSourceLabel = transcript.sourceFilePath ? 'Whisper fallback' : 'YouTube subtitles';

  const cleanText = transcript.cleanText ?? transcript.transcriptText;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanText).catch(() => {});
  };

  useEffect(() => {
    if (insightState?.actionKey) {
      onInsightTabChange?.(insightState.actionKey);
    }
  }, [insightState?.actionKey, onInsightTabChange]);

  const activeInsightTab = activeInsightTabProp ?? activeInsightTabLocal;
  const setActiveInsightTab = (tab: InsightTab) => {
    setPendingInsight(null);
    setSelectedInsightHistoryId(null);
    if (onInsightTabChange) {
      onInsightTabChange(tab);
      return;
    }

    setActiveInsightTabLocal(tab);
  };

  useEffect(() => {
    if (activeInsightTabProp) {
      setPendingInsight(null);
      setSelectedInsightHistoryId(null);
      setActiveInsightTabLocal(activeInsightTabProp);
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
  const balanceNotLoaded = billingBalanceLoading !== false && billingBalance === null;
  const pendingActionMeta = pendingInsight
    ? INSIGHT_TABS.find((tab) => tab.key === pendingInsight.actionKey) ?? activeInsightMeta
    : activeInsightMeta;
  const pendingEstimateCredits = pendingInsight ? pendingActionMeta.credits : estimateCredits;
  const canAffordPendingAction = availableCredits === null || availableCredits >= pendingEstimateCredits;
  const balanceSummary = billingBalance
    ? `${billingBalance.availableCredits} available · ${billingBalance.reservedCredits} reserved · ${billingBalance.balanceCredits} total`
    : billingBalanceError
      ? billingBalanceError
      : billingBalanceLoading
        ? 'Loading balance...'
        : 'Balance not loaded';

  const handleOpenGenerateConfirmation = () => {
    if (busy || !onRequestInsight) {
      return;
    }

    setSelectedInsightHistoryId(null);
    setPendingInsight({
      actionKey: activeInsightTab,
      question: null,
      conversationContext: null,
    });
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
    setSelectedInsightHistoryId(null);
    setPendingInsight({
      actionKey: 'ask-this-video',
      question,
      conversationContext,
    });
  };

  const handleCancelPendingInsight = () => {
    setPendingInsight(null);
  };

  const handleConfirmPendingInsight = () => {
    if (!pendingInsight || busy || !onRequestInsight) {
      return;
    }

    if (pendingInsight.actionKey === 'ask-this-video') {
      const question = pendingInsight.question?.trim();
      if (!question) {
        setPendingInsight(null);
        return;
      }

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
      onRequestInsight('ask-this-video', question, pendingInsight.conversationContext);
      setPendingInsight(null);
      return;
    }

    onRequestInsight(pendingInsight.actionKey);
    setPendingInsight(null);
  };

  const handleAskClear = () => {
    setAskMessages([]);
    setAskPendingQuestion(null);
    if (pendingInsight?.actionKey === 'ask-this-video') {
      setPendingInsight(null);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-[680px] mx-auto px-8 py-8">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent/20 border border-accent/40 flex-shrink-0">
              <Check size={16} className="text-accent" />
            </div>
            <h1 className="text-[26px] font-bold text-text-primary tracking-tight">Transcript ready</h1>
          </div>
          <p className="text-text-secondary text-[13px] ml-11">
            Your transcript has been generated successfully.<br />
            Explore the clean text below, then we can wire summary, chapters, and notes next.
          </p>
        </div>

        <div className="bg-bg-card border border-border rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <LinkIcon size={14} className="text-text-muted flex-shrink-0" />
          <span className="flex-1 text-[12px] text-text-secondary truncate">{url}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-accent">Completed</span>
          </div>
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <button
            onClick={onChangeUrl}
            className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            <Edit3 size={12} />
            Change
          </button>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 flex gap-4">
          <div className="w-[200px] h-[112px] bg-bg-input rounded-lg overflow-hidden flex-shrink-0 relative">
            <img
              src={videoMeta.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
              {videoMeta.duration}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-text-primary mb-2 leading-snug">{videoMeta.title}</h3>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-5 h-5 bg-bg-input rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-text-muted">YT</span>
              </div>
              <span className="text-[12px] text-text-secondary">{videoMeta.channel}</span>
              <span className="text-[11px] text-text-muted ml-1">{transcriptSourceLabel}</span>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Duration</div>
                <div className="text-[12px] font-medium text-text-primary">{formatDuration(transcript.durationSeconds)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Transcript source</div>
                <div className="text-[12px] font-medium text-text-primary">{transcriptSource}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted mb-0.5">Language</div>
                <div className="text-[12px] font-medium text-text-primary">{transcript.language.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-bg-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">Insights</div>
              <div className="text-[13px] text-text-secondary">Run one paid AI action at a time and view the result here.</div>
            </div>
            {insightState && (
              <div className="rounded-full border border-border bg-bg-input/50 px-3 py-1.5 text-[11px] text-text-muted">
                {busy ? 'Processing' : insightState.status}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {INSIGHT_TABS.map((tab) => {
              const active = activeInsightTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveInsightTab(tab.key)}
                  className={`flex min-w-[150px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border bg-bg-input/40 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-accent/15 text-accent' : 'bg-bg-card text-text-muted'}`}>
                    {tab.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-tight">{tab.label}</div>
                    <div className="mt-0.5 text-[10px] text-text-muted leading-snug">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 rounded-xl border border-border bg-bg-input/20 p-3 text-[11px] text-text-muted md:grid-cols-3">
            <div className="flex items-center gap-2">
              <CreditCard size={12} className="text-accent" />
              <span className="uppercase tracking-[0.12em]">Credits</span>
            </div>
            <div className="md:col-span-2 text-text-secondary">
              {balanceSummary}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-bg-input/30 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
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
                  onClick={handleOpenGenerateConfirmation}
                  disabled={busy || !onRequestInsight}
                  className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? 'Working…' : 'Review & run'}
                </button>
              )}
            </div>

            {activeInsightTab === 'ask-this-video' ? (
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
                      {busy ? 'Sending…' : 'Review & send'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {busy && insightState && insightState.actionKey === activeInsightTab && (
                  <div className="mb-4 rounded-xl border border-accent/20 bg-accent/8 px-3 py-2.5">
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
              </>
            )}

            {pendingInsight && (
              <div className="mt-4 rounded-xl border border-accent/25 bg-accent/8 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Confirm paid action</div>
                    <div className="mt-1 text-[14px] font-semibold text-text-primary">{pendingActionMeta.label}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                      This will spend {pendingEstimateCredits} credits.
                      {pendingInsight.actionKey === 'ask-this-video' && pendingInsight.question
                        ? ` Question: ${pendingInsight.question}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelPendingInsight}
                    className="text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-3 grid gap-2 text-[12px] md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Estimated cost</div>
                    <div className="mt-1 font-semibold text-text-primary">{pendingEstimateCredits} credits</div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Available</div>
                    <div className="mt-1 font-semibold text-text-primary">
                      {availableCredits === null ? '—' : `${availableCredits} credits`}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Balance</div>
                    <div className="mt-1 font-semibold text-text-primary">
                      {billingBalance ? `${billingBalance.balanceCredits} total` : 'Loading...'}
                    </div>
                  </div>
                </div>

                {availableCredits !== null && availableCredits < pendingEstimateCredits && (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
                    Not enough credits for this action. Top up your balance, or cancel and pick a cheaper action.
                  </div>
                )}

                {billingBalanceError && (
                  <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
                    Billing balance could not be loaded: {billingBalanceError}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-text-muted">
                    {balanceNotLoaded ? 'Checking your available credits before starting.' : 'You will confirm this action before any credits are reserved.'}
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmPendingInsight}
                    disabled={busy || !onRequestInsight || !canAffordPendingAction}
                    className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingInsight.actionKey === 'ask-this-video' ? 'Start chat' : 'Confirm and run'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0 mb-3 border-b border-border">
          {(['transcript', 'clean', 'chapters', 'notes'] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              transcript: 'Transcript',
              clean: 'Clean text',
              chapters: 'Chapters',
              notes: 'Notes',
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Copy size={13} />
            Copy transcript
          </button>
          <div className="relative">
            <button className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
              <Download size={13} />
              Export
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-1.5">
            <Search size={12} className="text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript"
              className="bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none w-[140px]"
            />
          </div>
          <button className="flex items-center gap-1.5 bg-bg-card border border-border hover:bg-bg-card-hover text-text-secondary text-[12px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
            <Globe size={12} />
            {transcript.language}
            <ChevronDown size={11} />
          </button>
        </div>

        {activeTab === 'transcript' && (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-3">
            <div className="divide-y divide-border">
              {filteredLines.map((line, i) => (
                <div key={`${i}-${line.slice(0, 24)}`} className="flex gap-4 px-4 py-3 hover:bg-bg-input/50 transition-colors group">
                  <div className="text-[12px] font-mono text-accent font-medium flex-shrink-0 w-[42px]">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <p className="text-[13px] text-text-secondary leading-relaxed flex-1">{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'clean' && (
          <div className="bg-bg-card border border-border rounded-xl p-4 mb-3">
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary font-sans">{cleanText}</pre>
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="space-y-3 mb-3">
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-accent" />
                <span className="text-[13px] font-semibold text-text-primary">Chapters</span>
              </div>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Chapters are generated deterministically from the transcript so the page stays fast and cheap.
              </p>
            </div>

            <div className="space-y-2">
              {chapters.map((chapter) => (
                <div key={`${chapter.title}-${chapter.startLabel}`} className="bg-bg-card border border-border rounded-xl p-4">
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

        {activeTab === 'notes' && (
          <div className="space-y-3 mb-3">
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareText size={14} className="text-accent" />
                <span className="text-[13px] font-semibold text-text-primary">Key Quotes</span>
              </div>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Important lines pulled directly from the transcript, without an LLM pass.
              </p>
            </div>

            <div className="space-y-2">
              {keyQuotes.length > 0 ? keyQuotes.map((quote) => (
                <div key={`${quote.timestamp}-${quote.quote.slice(0, 20)}`} className="bg-bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-accent">{quote.timestamp}</div>
                    <div className="text-[10px] text-text-muted">{quote.note}</div>
                  </div>
                  <p className="text-[13px] leading-relaxed text-text-secondary">“{quote.quote}”</p>
                </div>
              )) : (
                <div className="bg-bg-card border border-border rounded-xl p-4 text-[13px] leading-relaxed text-text-secondary">
                  No strong quote candidates found yet. We can improve this heuristic later or switch it to an LLM-backed quote picker.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pb-2">
          <p className="text-[11px] text-text-muted">
            Word count: {transcript.wordCount.toLocaleString()} &nbsp;•&nbsp; Character count: {transcript.characterCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Auto-scroll</span>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${autoScroll ? 'bg-accent' : 'bg-bg-input border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoScroll ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
