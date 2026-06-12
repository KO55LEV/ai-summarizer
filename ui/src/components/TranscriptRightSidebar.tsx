import {
  Sparkles,
  FileText,
  Star,
  Quote,
  MessageCircle,
  BookOpen,
  ChevronRight,
  Zap,
  HelpCircle,
  Highlighter,
  CreditCard,
  Brain,
  Map,
  BookMarked,
  Lightbulb,
  Clock3,
  ShieldAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranscriptInsightActionKey } from '../types';
import type { BillingBalanceResponse } from '../api/adminBilling';

interface TranscriptRightSidebarProps {
  sourceId?: string | null;
  requestedByUserId?: string | null;
  billingBalance?: BillingBalanceResponse | null;
  billingBalanceLoading?: boolean;
  billingBalanceError?: string | null;
  insightState?: {
    actionKey: TranscriptInsightActionKey;
    status: string;
    promptKey: string;
    estimatedCredits: number;
    result: Record<string, unknown> | null;
    error?: string | null;
  } | null;
  onRequestInsight?: (actionKey: TranscriptInsightActionKey) => void;
  onSelectInsightTab?: (actionKey: TranscriptInsightActionKey) => void;
}

type InsightItem = {
  actionKey: TranscriptInsightActionKey;
  icon: ReactNode;
  title: string;
  description: string;
  credits: number;
};

const INSIGHTS: InsightItem[] = [
  {
    actionKey: 'quick-summary',
    icon: <FileText size={15} className="text-[#4dc8e8]" />,
    title: 'Quick Summary',
    description: 'A concise overview of the entire video in plain language.',
    credits: 10,
  },
  {
    actionKey: 'key-takeaways',
    icon: <Star size={15} className="text-[#4dc8e8]" />,
    title: 'Key Takeaways',
    description: 'The most important points, clearly and simply.',
    credits: 10,
  },
  {
    actionKey: 'ask-this-video',
    icon: <MessageCircle size={15} className="text-[#4dc8e8]" />,
    title: 'Ask this video',
    description: 'Ask a question and get an answer grounded in the transcript.',
    credits: 10,
  },
  {
    actionKey: 'study-guide',
    icon: <BookOpen size={15} className="text-[#4dc8e8]" />,
    title: 'Study Guide',
    description: 'Quizzes, flashcards, and a quick review to test your knowledge.',
    credits: 10,
  },
];

const ACTIONS = [
  { icon: <Sparkles size={13} />, label: 'Summarize Transcript' },
  { icon: <HelpCircle size={13} />, label: 'Q&A' },
  { icon: <Highlighter size={13} />, label: 'Highlights' },
  { icon: <CreditCard size={13} />, label: 'Flash Cards' },
  { icon: <Brain size={13} />, label: 'Quiz' },
  { icon: <Map size={13} />, label: 'Mindmap' },
];

const NOTES = [
  { icon: <Quote size={13} />, label: 'Key Quotes', count: 24 },
  { icon: <Highlighter size={13} />, label: 'Highlights', count: 18 },
  { icon: <BookMarked size={13} />, label: 'Study Guide', count: 0 },
];

function isBusy(status?: string | null): boolean {
  return status === 'starting' || status === 'queued' || status === 'running' || status === 'waiting';
}

export default function TranscriptRightSidebar({
  sourceId,
  requestedByUserId,
  billingBalance,
  billingBalanceLoading,
  billingBalanceError,
  insightState,
  onSelectInsightTab,
}: TranscriptRightSidebarProps) {
  const busy = isBusy(insightState?.status);
  const activeLabel = INSIGHTS.find((item) => item.actionKey === insightState?.actionKey)?.title ?? 'LLM action';

  return (
    <aside className="w-[260px] flex-shrink-0 border-l border-border bg-bg-secondary h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-5">
        <div className="mb-5 rounded-xl border border-border bg-bg-card p-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-lg bg-accent/15 p-1.5 text-accent">
              <Clock3 size={13} />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-text-primary">Paid AI actions</div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                These buttons run an LLM workflow and consume credits.
              </div>
            </div>
          </div>
          {busy && insightState && (
            <div className="mt-3 rounded-lg border border-accent/20 bg-accent/8 px-3 py-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                <Sparkles size={12} className="text-accent" />
                Generating {activeLabel}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                Estimated cost: {insightState.estimatedCredits} credits
              </div>
            </div>
          )}
          {!busy && insightState?.status === 'succeeded' && insightState.result && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                <Sparkles size={12} className="text-emerald-400" />
                {activeLabel} ready
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                Prompt: {insightState.promptKey}
              </div>
            </div>
          )}
          {!busy && insightState?.status === 'failed' && (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                <ShieldAlert size={12} className="text-red-400" />
                AI action failed
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                {insightState.error ?? 'The workflow could not be completed.'}
              </div>
            </div>
          )}
          <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-text-muted">
            {sourceId ? 'Source connected' : 'No source selected'}
            {requestedByUserId ? ' · billing enabled' : ''}
          </div>
          <div className="mt-3 rounded-lg border border-border bg-bg-input/30 px-3 py-2 text-[11px] text-text-muted">
            <div className="flex items-center gap-2 text-text-primary">
              <CreditCard size={12} className="text-accent" />
              <span className="font-medium">Balance preview</span>
            </div>
            <div className="mt-1 leading-relaxed">
              {billingBalance
                ? `${billingBalance.availableCredits} available · ${billingBalance.reservedCredits} reserved`
                : billingBalanceError
                  ? billingBalanceError
                  : billingBalanceLoading
                    ? 'Loading balance...'
                    : 'Balance not loaded'}
            </div>
          </div>
        </div>

        {/* ── Insights ──────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Insights</span>
          </div>
          <div className="space-y-0.5">
            {INSIGHTS.map((item) => (
              <button
                key={item.title}
                onClick={() => {
                  onSelectInsightTab?.(item.actionKey);
                }}
                disabled={!sourceId || busy}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer group text-left"
              >
                <div className="w-[28px] h-[28px] rounded-md flex items-center justify-center flex-shrink-0 bg-bg-card border border-border group-hover:border-[#2a5070] transition-colors">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-text-primary leading-tight">{item.title}</div>
                  <div className="text-[10px] text-text-muted leading-snug mt-0.5">{item.description}</div>
                  <div className="mt-1 text-[10px] text-accent">{item.credits} credits</div>
                </div>
                <ChevronRight size={13} className="text-text-muted/50 flex-shrink-0 mt-1 group-hover:text-text-muted transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIONS.map((action) => (
              <button
                key={action.label}
                className="flex items-center gap-1.5 bg-bg-card hover:bg-bg-card-hover border border-border rounded-lg px-2.5 py-2 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <span className="text-accent">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Your notes ────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={13} className="text-accent" />
            <span className="text-[13px] font-semibold text-text-primary">Your notes</span>
          </div>
          <div className="space-y-0.5">
            {NOTES.map((note) => (
              <button
                key={note.label}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer group"
              >
                <div className="w-[28px] h-[28px] rounded-md flex items-center justify-center flex-shrink-0 bg-bg-card border border-border text-text-muted group-hover:text-accent transition-colors">
                  {note.icon}
                </div>
                <span className="flex-1 text-[12px] font-medium text-text-primary text-left">{note.label}</span>
                <span className="text-[11px] text-text-muted flex-shrink-0">{note.count > 0 ? note.count : ''}</span>
                <ChevronRight size={13} className="text-text-muted/50 flex-shrink-0 group-hover:text-text-muted transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* ── View all ──────────────────────────────── */}
        <button className="w-full text-[11px] text-accent hover:text-accent-hover font-medium text-center py-1.5 cursor-pointer transition-colors">
          View all notes &amp; outputs →
        </button>

      </div>
    </aside>
  );
}
