import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Edit3,
  FileText,
  Play,
  Clock,
  Calendar,
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
  listResearchRunRankedDocuments,
  listResearchRunSearchResults,
  listResearchRuns,
  startResearchRun,
  updateResearchTopic,
} from '../../api/research';
import { analyzeVideo } from '../../api';
import { getCurrentUserId } from '../../config/currentUser';
import type { ResearchRankedDocument } from '../../api/types';

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

function normalizeHost(urlOrHost: string): string {
  try {
    const value = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost;
    return value.replace(/^www\./i, '').trim().toLowerCase();
  } catch {
    return urlOrHost.replace(/^www\./i, '').trim().toLowerCase();
  }
}

function extractDomainCitation(text: string): { domain: string; label: string } | null {
  const match = text.match(/\(([^()]+)\)$/);
  if (!match) return null;

  const parts = match[1].split(',').map((part) => part.trim()).filter(Boolean);
  const domain = parts[parts.length - 1];
  if (!domain || !domain.includes('.')) return null;

  return {
    domain,
    label: match[1],
  };
}

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
  const [rankedDocuments, setRankedDocuments] = useState<ResearchRankedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    if (runs.length === 0) {
      setRankedDocuments([]);
      setReferencesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const latestRun = runs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!latestRun) {
      setRankedDocuments([]);
      setReferencesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setReferencesLoading(true);
    listResearchRunRankedDocuments(latestRun.id)
      .then((documents) => {
        if (!cancelled) {
          setRankedDocuments(documents);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRankedDocuments([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReferencesLoading(false);
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
        lookbackWindow: topic.lookbackWindow,
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
    <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.07),transparent_28%),radial-gradient(circle_at_top_right,rgba(94,234,212,0.05),transparent_22%),linear-gradient(180deg,#0b1120_0%,#0c1221_32%,#0c1221_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <BackButton onBack={onBack} />
          <div className="flex flex-wrap items-center gap-2">
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

        <section className="relative overflow-hidden rounded-[28px] border border-white/5 bg-[linear-gradient(180deg,rgba(15,21,38,0.98),rgba(11,17,31,0.98))] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/35 to-transparent" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--color-accent)]/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-cyan-400/5 blur-3xl" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-[1120px]">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  <span>Research</span>
                  <span className="text-[var(--color-text-muted)]/60">/</span>
                  <span>Topic overview</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-[34px]">
                    {topic.name}
                  </h1>
                  <StatusBadge status={topic.status} />
                </div>
                <p className="mt-3 max-w-[1200px] text-[15px] leading-7 text-[var(--color-text-secondary)]">
                  {topic.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <InfoPill icon={<Calendar size={14} />} label="Frequency">
                <span className="font-medium capitalize" style={{ color: FREQ_COLORS[topic.frequency] }}>{topic.frequency}</span>
              </InfoPill>
              <InfoPill icon={<Clock size={14} />} label="Delivery">{topic.deliveryTime ?? '—'}</InfoPill>
              <InfoPill icon={<Clock size={14} />} label="Last run">{topic.lastRun}</InfoPill>
              <InfoPill icon={<ChevronRight size={14} />} label="Next run">{topic.nextRun}</InfoPill>
              <InfoPill icon={<FileText size={14} />} label="Briefings">{topic.briefingsCount}</InfoPill>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent)] shadow-[0_10px_30px_rgba(0,212,170,0.08)]">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-[linear-gradient(180deg,rgba(14,20,35,0.92),rgba(11,17,31,0.96))] p-1 shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
          <div className="flex flex-wrap gap-1">
            {(['latest', 'history', 'runs', 'settings'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition-all"
                  style={{
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    background: isActive ? 'rgba(0, 212, 170, 0.1)' : 'transparent',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(0, 212, 170, 0.25)' : 'none',
                  }}
                >
                  {tab === 'latest' ? (briefingId ? 'Report' : 'Latest report') : tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pb-4">
          {activeTab === 'latest' && (
            briefing ? (
              <ReportView
                briefing={briefing}
                topic={topic}
                searchResults={searchResults}
                rankedDocuments={rankedDocuments}
                searchLoading={searchLoading}
                referencesLoading={referencesLoading}
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
        </div>
      </div>
    </main>
  );
}

function ReportView({
  briefing,
  topic,
  searchResults,
  rankedDocuments,
  searchLoading,
  referencesLoading,
  actionBusy,
  onProcessVideo,
}: {
  briefing: ResearchBriefing;
  topic: ResearchTopic;
  searchResults: ResearchSearchResult[];
  rankedDocuments: ResearchRankedDocument[];
  searchLoading: boolean;
  referencesLoading: boolean;
  actionBusy: string | null;
  onProcessVideo: (video: ResearchSearchResult) => void;
}) {
  const videoResults = searchResults.filter((result) => result.sourceKey.toLowerCase() === 'youtube' || (result.domain ?? '').toLowerCase().includes('youtube'));
  const references = rankedDocuments
    .slice()
    .sort((a, b) => a.rankPosition - b.rankPosition)
    .filter((doc) => Boolean(doc.canonicalUrl));
  const referenceUrlByDomain = new Map<string, string>();
  for (const reference of references) {
    const domain = normalizeHost(reference.canonicalUrl);
    if (domain && !referenceUrlByDomain.has(domain)) {
      referenceUrlByDomain.set(domain, reference.canonicalUrl);
    }
  }

  const linkForDomain = (domain: string | null | undefined): string => {
    if (!domain) {
      return '#references';
    }

    return referenceUrlByDomain.get(normalizeHost(domain)) ?? '#references';
  };

  const renderBriefingItem = (item: string, tone: string) => {
    const citation = extractDomainCitation(item);
    const href = linkForDomain(citation?.domain);
    const isExternal = href !== '#references';

    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="group inline-flex items-start gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--color-bg-hover)]/30 hover:text-[var(--color-text-primary)]"
        title={citation?.domain ? `Open reference for ${citation.domain}` : 'Open references'}
      >
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SENTIMENT_COLORS[tone] ?? SENTIMENT_COLORS.neutral }} />
        <span>{item}</span>
        <ExternalLink size={11} className="mt-1 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
      </a>
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
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
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-hover)]/40 px-4 py-6 text-sm text-[var(--color-text-muted)]">
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
                  <div key={video.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/70 p-4">
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

        <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Executive Summary</h2>
          <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{briefing.summary}</p>
        </section>

        {briefing.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]"
            style={{ borderLeft: `3px solid ${SENTIMENT_COLORS[section.sentiment]}` }}
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h2>
              <SentimentBadge sentiment={section.sentiment} />
            </div>
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="text-sm text-[var(--color-text-secondary)]">
                  {renderBriefingItem(item, section.sentiment)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
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

        <section id="references" className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sources ({briefing.sources.length})</h2>
          <div className="flex flex-wrap gap-2">
            {briefing.sources.map((source) => (
              <a
                key={`${source.domain}-${source.title}`}
                href={linkForDomain(source.domain)}
                target={linkForDomain(source.domain) === '#references' ? undefined : '_blank'}
                rel={linkForDomain(source.domain) === '#references' ? undefined : 'noopener noreferrer'}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:opacity-80"
                title={source.title}
              >
                <ExternalLink size={11} />
                {source.domain}
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">References ({references.length})</h2>
          {referencesLoading ? (
            <div className="space-y-2">
              <div className="h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 animate-pulse" />
              <div className="h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 animate-pulse" />
            </div>
          ) : references.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No article references are available for this report yet.</p>
          ) : (
            <div className="space-y-2">
              {references.slice(0, 12).map((reference) => (
                <a
                  key={reference.id}
                  href={reference.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/55 px-3 py-3 transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-hover)]/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{reference.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <span>{reference.sourceKey}</span>
                        <span>•</span>
                        <span className="truncate">{reference.canonicalUrl}</span>
                      </div>
                    </div>
                    <ExternalLink size={12} className="mt-0.5 shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
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
    return <div className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-6 text-sm text-[var(--color-text-muted)] shadow-[0_18px_45px_rgba(0,0,0,0.2)]">No historical reports yet.</div>;
  }

  return (
    <div className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/70 p-4">
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
    return <div className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-6 text-sm text-[var(--color-text-muted)] shadow-[0_18px_45px_rgba(0,0,0,0.2)]">No runs yet.</div>;
  }

  return (
    <div className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
      <div className="space-y-3">
        {runs.map((run) => {
          const workflowId = run.workflowId;
          return (
            <div key={run.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/70 p-4">
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
  const lookbackLabel = formatLookbackWindow(topic.lookbackWindow, topic.frequency);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
        <div className="grid gap-3 md:grid-cols-4">
          <SettingsMetric label="Cadence" value={formatCadence(topic.frequency)} />
          <SettingsMetric label="Lookback window" value={lookbackLabel} />
          <SettingsMetric label="Delivery" value={topic.deliveryTime ?? '—'} />
          <SettingsMetric label="Next run" value={topic.nextRun} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard title="Intent">{topic.description || 'No intent provided.'}</SettingsCard>
        <SettingsCard title="Schedule">
          <div className="space-y-2">
            <SettingsRow label="Cadence" value={formatCadence(topic.frequency)} />
            <SettingsRow label="Lookback window" value={lookbackLabel} />
            <SettingsRow label="Delivery" value={topic.deliveryTime ?? '—'} />
            <SettingsRow label="Next run" value={topic.nextRun} />
          </div>
        </SettingsCard>
        <SettingsCard title="Sources">{topic.sources.join(', ') || 'No sources selected.'}</SettingsCard>
        <SettingsCard title="Outputs">
          {topic.outputs.join(', ') || 'No outputs selected.'}
          {topic.outputs.includes('voice') && <div className="mt-2 text-xs text-[var(--color-text-muted)]">Voice summary is stored as a preference only. Audio generation is coming later.</div>}
        </SettingsCard>
        <SettingsCard title="Tags">{topic.tags.join(', ') || 'No tags.'}</SettingsCard>
        <SettingsCard title="Project">{topic.projectId ?? 'Not linked to a project.'}</SettingsCard>
      </div>
    </div>
  );
}

function EmptyReport({ onRunNow, disabled }: { onRunNow: () => void; disabled: boolean }) {
  return (
    <div className="rounded-[28px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.2)] sm:p-8">
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--color-border)] bg-[radial-gradient(circle_at_top,rgba(0,212,170,0.08),transparent_55%),rgba(10,15,28,0.4)] px-6 py-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-[var(--color-accent)] shadow-[0_0_0_1px_rgba(0,212,170,0.05)]">
          <FileText size={22} />
        </div>
        <div className="mb-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">No briefing available yet.</div>
        <p className="max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
          Run this topic to generate the first online report.
        </p>
        <button
          onClick={onRunNow}
          disabled={disabled}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--color-accent)' }}
        >
          <Play size={14} fill="black" />
          Run now
        </button>
        <div className="mt-6 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 px-3 py-2">Schedules the first scan</div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 px-3 py-2">Collects sources and runs</div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 px-3 py-2">Generates a briefing</div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,24,41,0.96),rgba(13,19,34,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{title}</h2>
      <div className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{children}</div>
    </section>
  );
}

function SettingsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/70 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)]/70 px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text-primary)] text-right">{value}</span>
    </div>
  );
}

function formatCadence(frequency: ResearchTopic['frequency']): string {
  switch (frequency) {
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return frequency;
  }
}

function formatLookbackWindow(lookbackWindow: ResearchTopic['lookbackWindow'], frequency: ResearchTopic['frequency']): string {
  if (!lookbackWindow) {
    return `Same as ${formatCadence(frequency).toLowerCase()}`;
  }

  switch (lookbackWindow) {
    case 'hour':
      return '1 hour';
    case 'day':
      return '1 day';
    case 'week':
      return '1 week';
    case 'month':
      return '1 month';
    default:
      return lookbackWindow;
  }
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/5 bg-[rgba(14,20,35,0.78)] px-4 py-2 text-sm text-[var(--color-text-muted)] shadow-[0_10px_30px_rgba(0,0,0,0.16)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)]">
      <ArrowLeft size={15} />
      <span>Research</span>
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
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[rgba(10,15,28,0.6)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <div className="min-w-0">
        <span className="block text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</span>
        <span className="block text-sm font-medium text-[var(--color-text-primary)]">{children}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchTopic['status'] }) {
  const color = status === 'active' ? 'var(--color-accent)' : status === 'paused' ? '#f59e0b' : 'var(--color-text-muted)';
  return <span className="rounded-full px-2.5 py-1 text-xs font-medium capitalize" style={{ background: `${color}22`, color }}>{status}</span>;
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
    <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.07),transparent_28%),radial-gradient(circle_at_top_right,rgba(94,234,212,0.05),transparent_22%),linear-gradient(180deg,#0b1120_0%,#0c1221_32%,#0c1221_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <BackButton onBack={onBack} />
        <div className="space-y-4">
          <div className="h-14 animate-pulse rounded-[28px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
          <div className="h-20 animate-pulse rounded-[28px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_380px]">
            <div className="space-y-4">
              <div className="h-72 animate-pulse rounded-[24px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
              <div className="h-40 animate-pulse rounded-[24px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
            </div>
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-[24px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
              <div className="h-40 animate-pulse rounded-[24px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
              <div className="h-40 animate-pulse rounded-[24px] border border-white/5 bg-[rgba(19,28,48,0.5)]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
