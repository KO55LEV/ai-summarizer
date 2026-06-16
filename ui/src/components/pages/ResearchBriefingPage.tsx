import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Edit3,
  Play,
  Clock,
  Calendar,
  FileText,
  ExternalLink,
  ChevronRight,
  Pause,
  RotateCcw,
  Trash2,
  Video,
  Youtube,
  Languages,
} from 'lucide-react';
import type { ResearchTopic, ResearchBriefing, PastBriefing, ResearchTopicRun, ResearchSearchResult } from '../../api/types';
import {
  deleteResearchTopic,
  getResearchBriefing,
  getResearchBriefingById,
  listResearchBriefings,
  listResearchRunSearchResults,
  listResearchRuns,
  startResearchRun,
  updateResearchTopic,
} from '../../api/research';
import { analyzeVideo } from '../../api';
import { getCurrentUserId } from '../../config/currentUser';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'var(--color-accent)',
  neutral: 'var(--color-info, #4dc8e8)',
  negative: '#ef4444',
};

const FREQ_COLORS: Record<string, string> = {
  hourly: 'var(--color-info, #4dc8e8)',
  daily: 'var(--color-accent)',
  weekly: '#a78bfa',
  monthly: '#f59e0b',
};

interface ResearchBriefingPageProps {
  topic: ResearchTopic;
  briefingId?: string | null;
  onBack: () => void;
  onEdit: () => void;
  onOpenBriefing: (briefingId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenTranscript: (sourceId: string | null, sourceUrl: string, title: string, channel: string, language?: string | null) => void;
  onTopicChanged: (topic: ResearchTopic) => void;
}

export function ResearchBriefingPage({
  topic,
  briefingId,
  onBack,
  onEdit,
  onOpenBriefing,
  onOpenWorkflow,
  onOpenTranscript,
  onTopicChanged,
}: ResearchBriefingPageProps) {
  const [briefing, setBriefing] = useState<ResearchBriefing | null>(null);
  const [history, setHistory] = useState<PastBriefing[]>([]);
  const [runs, setRuns] = useState<ResearchTopicRun[]>([]);
  const [searchResults, setSearchResults] = useState<ResearchSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | 'runs' | 'settings'>(briefingId ? 'latest' : 'latest');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasActiveRun = runs.some((run) => ['queued', 'running'].includes(run.status));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      briefingId ? getResearchBriefingById(topic.id, briefingId) : getResearchBriefing(topic.id),
      listResearchBriefings(topic.id),
      listResearchRuns(topic.id),
    ]).then(([nextBriefing, nextHistory, nextRuns]) => {
      if (cancelled) return;
      setBriefing(nextBriefing);
      setHistory(nextHistory);
      setRuns(nextRuns);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : 'Failed to load research topic details');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [briefingId, topic.id]);

  useEffect(() => {
    let cancelled = false;

    if (runs.length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const latestRun = runs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!latestRun) {
      setSearchResults([]);
      setSearchLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setSearchLoading(true);
    listResearchRunSearchResults(latestRun.id)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runs]);

  const refreshRuns = async () => {
    setRuns(await listResearchRuns(topic.id));
  };

  const runNow = async () => {
    setActionBusy('run');
    setMessage(null);
    try {
      const result = await startResearchRun(topic.id, getCurrentUserId());
      setMessage(result.message);
      await refreshRuns();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to start research run');
    } finally {
      setActionBusy(null);
    }
  };

  const processVideo = async (video: ResearchSearchResult) => {
    setActionBusy(video.id);
    setMessage(null);
    try {
      const response = await analyzeVideo({
        youtubeUrl: video.canonicalUrl ?? video.url,
        requestedByUserId: getCurrentUserId(),
        projectId: topic.projectId,
      });

      const sourceId = response.transcript?.sourceId ?? response.workflow?.sourceId;
      if (sourceId) {
        onOpenTranscript(sourceId, video.canonicalUrl ?? video.url, video.title, video.authorName ?? video.domain ?? 'YouTube', video.language);
        return;
      }

      setMessage(response.workflow?.status === 'queued' ? 'Video queued for processing.' : 'Video processing started.');
      await refreshRuns();
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : 'Failed to process video');
    } finally {
      setActionBusy(null);
    }
  };

  const toggleStatus = async () => {
    setActionBusy('status');
    setMessage(null);
    try {
      const updated = await updateResearchTopic(topic.id, {
        projectId: topic.projectId,
        name: topic.name,
        description: topic.description,
        frequency: topic.frequency,
        status: topic.status === 'active' ? 'paused' : 'active',
        deliveryTime: topic.deliveryTime,
        sources: topic.sources,
        tags: topic.tags,
        outputs: topic.outputs,
      });
      onTopicChanged(updated);
      setMessage(updated.status === 'active' ? 'Topic resumed.' : 'Topic paused.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update research topic');
    } finally {
      setActionBusy(null);
    }
  };

  const deleteTopic = async () => {
    if (!window.confirm(`Delete research topic "${topic.name}"?`)) return;
    setActionBusy('delete');
    try {
      await deleteResearchTopic(topic.id);
      onBack();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete research topic');
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return <BriefingSkeletonLoader onBack={onBack} />;

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      <div className="mb-5 flex items-center justify-between">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-2">
          <ActionButton onClick={runNow} disabled={Boolean(actionBusy) || hasActiveRun} accent icon={<Play size={13} fill="black" />}>
            {hasActiveRun ? 'Run active' : actionBusy === 'run' ? 'Queueing...' : 'Run now'}
          </ActionButton>
          <ActionButton onClick={onEdit} disabled={Boolean(actionBusy)} icon={<Edit3 size={13} />}>
            Edit
          </ActionButton>
          <ActionButton onClick={toggleStatus} disabled={Boolean(actionBusy)} icon={topic.status === 'active' ? <Pause size={13} /> : <RotateCcw size={13} />}>
            {topic.status === 'active' ? 'Pause' : 'Resume'}
          </ActionButton>
          <ActionButton onClick={deleteTopic} disabled={Boolean(actionBusy)} danger icon={<Trash2 size={13} />}>
            Delete
          </ActionButton>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{topic.name}</h1>
          <StatusBadge status={topic.status} />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{topic.description}</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-5 rounded-xl bg-[var(--color-bg-card)] px-5 py-3 text-sm">
        <InfoPill icon={<Calendar size={14} />} label="Frequency">
          <span className="capitalize font-medium" style={{ color: FREQ_COLORS[topic.frequency] }}>{topic.frequency}</span>
        </InfoPill>
        <InfoPill icon={<Clock size={14} />} label="Delivery">{topic.deliveryTime ?? '—'}</InfoPill>
        <InfoPill icon={<Clock size={14} />} label="Last run">{topic.lastRun}</InfoPill>
        <InfoPill icon={<ChevronRight size={14} />} label="Next run">{topic.nextRun}</InfoPill>
        <InfoPill icon={<FileText size={14} />} label="Briefings">{topic.briefingsCount}</InfoPill>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent)]">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-5 flex gap-2 border-b border-[var(--color-border)]">
        {(['latest', 'history', 'runs', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{
              color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {tab === 'latest' ? (briefingId ? 'Report' : 'Latest report') : tab}
          </button>
        ))}
      </div>

      {activeTab === 'latest' && (
        briefing ? (
          <ReportView
            briefing={briefing}
            topic={topic}
            searchResults={searchResults}
            searchLoading={searchLoading}
            actionBusy={actionBusy}
            onProcessVideo={processVideo}
          />
        ) : (
          <EmptyReport onRunNow={runNow} disabled={Boolean(actionBusy) || hasActiveRun} />
        )
      )}

      {activeTab === 'history' && (
        <HistoryView history={history} currentBriefingId={briefing?.id ?? null} onOpenBriefing={onOpenBriefing} />
      )}

      {activeTab === 'runs' && <RunsView runs={runs} onOpenWorkflow={onOpenWorkflow} />}

      {activeTab === 'settings' && <SettingsView topic={topic} />}
    </main>
  );
}

function ReportView({
  briefing,
  topic,
  searchResults,
  searchLoading,
  actionBusy,
  onProcessVideo,
}: {
  briefing: ResearchBriefing;
  topic: ResearchTopic;
  searchResults: ResearchSearchResult[];
  searchLoading: boolean;
  actionBusy: string | null;
  onProcessVideo: (video: ResearchSearchResult) => void;
}) {
  const videoResults = searchResults.filter((result) => result.sourceKey.toLowerCase() === 'youtube' || (result.domain ?? '').toLowerCase().includes('youtube'));

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 flex flex-col gap-4">
        <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Found videos</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {searchLoading ? 'Loading search results...' : `${videoResults.length} YouTube results ready for review.`}
              </p>
            </div>
            <Youtube size={16} className="text-[var(--color-text-muted)]" />
          </div>

          {videoResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
              No YouTube results are available yet for this run.
            </div>
          ) : (
            <div className="grid gap-3">
              {videoResults.map((video) => {
                const sourceTitle = video.title || 'Untitled video';
                const channel = video.authorName || video.domain || 'YouTube';
                const language = video.language?.toUpperCase() ?? '—';
                const sourceUrl = video.canonicalUrl ?? video.url;
                return (
                  <div key={video.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Video size={14} className="shrink-0 text-[var(--color-accent)]" />
                          <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{sourceTitle}</h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                          <span>{channel}</span>
                          <span className="inline-flex items-center gap-1"><Languages size={11} />{language}</span>
                          <span>{video.domain ?? video.sourceKey}</span>
                        </div>
                        {video.snippet && <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{video.snippet}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => onProcessVideo(video)}
                          disabled={actionBusy === video.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Play size={12} fill="black" />
                          {actionBusy === video.id ? 'Processing...' : 'Process video'}
                        </button>
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Executive Summary</h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{briefing.summary}</p>
        </section>

        {briefing.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl bg-[var(--color-bg-card)] p-5"
            style={{ borderLeft: `3px solid ${SENTIMENT_COLORS[section.sentiment]}` }}
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h2>
              <SentimentBadge sentiment={section.sentiment} />
            </div>
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SENTIMENT_COLORS[section.sentiment] }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Report Metadata
          </h2>
          <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
            <div>Generated: {briefing.generatedAt}</div>
            <div>Period: {briefing.period}</div>
            <div>Read time: {briefing.readTime}</div>
            <div>Words: {briefing.wordCount.toLocaleString()}</div>
          </div>
        </section>

        <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sources ({briefing.sources.length})</h2>
          <div className="flex flex-wrap gap-2">
            {briefing.sources.map((source) => (
              <a
                key={`${source.domain}-${source.title}`}
                href={`https://${source.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:opacity-80"
                title={source.title}
              >
                <ExternalLink size={11} />
                {source.domain}
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Structured Insights</h2>
          {topic.outputs.includes('structured') ? (
            <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-3 text-xs text-[var(--color-text-secondary)]">
              {JSON.stringify({ summary: briefing.summary, sections: briefing.sections, sources: briefing.sources }, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">Structured output is not selected for this topic.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryView({ history, currentBriefingId, onOpenBriefing }: { history: PastBriefing[]; currentBriefingId: string | null; onOpenBriefing: (briefingId: string) => void }) {
  if (history.length === 0) {
    return <div className="rounded-xl bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">No historical reports yet.</div>;
  }

  return (
    <div className="rounded-xl bg-[var(--color-bg-card)] p-5">
      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">{item.date}</div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">{item.preview}</p>
            </div>
            <button
              onClick={() => onOpenBriefing(item.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-black"
              style={{ background: currentBriefingId === item.id ? 'var(--color-text-muted)' : 'var(--color-accent)' }}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunsView({ runs, onOpenWorkflow }: { runs: ResearchTopicRun[]; onOpenWorkflow: (workflowId: string) => void }) {
  if (runs.length === 0) {
    return <div className="rounded-xl bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">No runs yet.</div>;
  }

  return (
    <div className="rounded-xl bg-[var(--color-bg-card)] p-5">
      <div className="space-y-3">
        {runs.map((run) => {
          const workflowId = run.workflowId;
          return (
            <div key={run.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <RunStatusBadge status={run.status} />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{run.triggeredBy ?? 'unknown'} run</span>
                </div>
                <div className="flex items-center gap-2">
                  {workflowId && (
                    <button
                      type="button"
                      onClick={() => onOpenWorkflow(workflowId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      <ExternalLink size={12} />
                      Workflow
                    </button>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-[var(--color-text-muted)] md:grid-cols-3">
                <div>Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}</div>
                <div>Finished: {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</div>
                <div>Workflow: {run.workflowId ?? '—'}</div>
                <div>Job: {run.jobId ?? '—'}</div>
              </div>
              {(run.errorCode || run.errorMessage) && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {run.errorCode ? `${run.errorCode}: ` : ''}{run.errorMessage}
                </div>
              )}
              {run.summaryPreview && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{run.summaryPreview}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({ topic }: { topic: ResearchTopic }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SettingsCard title="Intent">{topic.description || 'No intent provided.'}</SettingsCard>
      <SettingsCard title="Schedule">
        Cadence: {topic.frequency}. Delivery: {topic.deliveryTime ?? '—'}. Next run: {topic.nextRun}.
      </SettingsCard>
      <SettingsCard title="Sources">{topic.sources.join(', ') || 'No sources selected.'}</SettingsCard>
      <SettingsCard title="Outputs">
        {topic.outputs.join(', ') || 'No outputs selected.'}
        {topic.outputs.includes('voice') && <div className="mt-2 text-xs text-[var(--color-text-muted)]">Voice summary is stored as a preference only. Audio generation is coming later.</div>}
      </SettingsCard>
      <SettingsCard title="Tags">{topic.tags.join(', ') || 'No tags.'}</SettingsCard>
      <SettingsCard title="Project">{topic.projectId ?? 'Not linked to a project.'}</SettingsCard>
    </div>
  );
}

function EmptyReport({ onRunNow, disabled }: { onRunNow: () => void; disabled: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-card)] p-10 text-center">
      <div className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">No briefing available yet.</div>
      <p className="mb-5 text-sm text-[var(--color-text-muted)]">Run this topic to generate the first online report.</p>
      <button
        onClick={onRunNow}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        style={{ background: 'var(--color-accent)' }}
      >
        <Play size={14} fill="black" />
        Run now
      </button>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-[var(--color-bg-card)] p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{title}</h2>
      <div className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{children}</div>
    </section>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors">
      <ArrowLeft size={15} />
      Research
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  children,
  accent,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: accent ? 'var(--color-accent)' : danger ? '#ef444422' : 'var(--color-bg-card)',
        color: accent ? 'black' : danger ? '#ef4444' : 'var(--color-text-secondary)',
        border: accent ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function InfoPill({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <span className="text-xs text-[var(--color-text-muted)]">{label}:</span>
      <span className="text-xs font-medium text-[var(--color-text-primary)]">{children}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchTopic['status'] }) {
  const color = status === 'active' ? 'var(--color-accent)' : status === 'paused' ? '#f59e0b' : 'var(--color-text-muted)';
  return <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: `${color}22`, color }}>{status}</span>;
}

function RunStatusBadge({ status }: { status: string }) {
  const color = status === 'succeeded' || status === 'completed' ? 'var(--color-accent)' : status === 'failed' ? '#ef4444' : status === 'running' ? '#4dc8e8' : '#f59e0b';
  return <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: `${color}22`, color }}>{status}</span>;
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: `${SENTIMENT_COLORS[sentiment]}22`, color: SENTIMENT_COLORS[sentiment] }}>
      {sentiment}
    </span>
  );
}

function BriefingSkeletonLoader({ onBack }: { onBack: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      <BackButton onBack={onBack} />
      <div className="mt-5 space-y-4">
        <div className="h-7 w-64 animate-pulse rounded-lg bg-[var(--color-bg-card)]" />
        <div className="h-12 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />)}
          </div>
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
            <div className="h-24 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
          </div>
        </div>
      </div>
    </main>
  );
}
