import { useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  ArrowLeft,
  Plus,
  X,
  Globe,
  Newspaper,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Twitter,
  Youtube,
  Sparkles,
  Wand2,
  FileCode2,
  Volume2,
  LayoutTemplate,
  Languages,
  ShieldCheck,
  Clock3,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { createResearchTopic, updateResearchTopic } from '../../api/research';
import { getCurrentUserId } from '../../config/currentUser';
import type { ResearchTopic } from '../../api/types';

const SOURCE_OPTIONS = [
  { id: 'web', label: 'Web Search', icon: <Globe size={16} />, description: 'Search the open web for recent signals and context.' },
  { id: 'news', label: 'News', icon: <Newspaper size={16} />, description: 'Major publications, press releases, and breaking coverage.' },
  { id: 'archive', label: 'Archive', icon: <BookOpen size={16} />, description: 'Historical pages, archived copies, and older references.' },
  { id: 'reddit', label: 'Reddit', icon: <MessageSquare size={16} />, description: 'Community discussion, pain points, and early reactions.' },
  { id: 'financial', label: 'Financial Data', icon: <TrendingUp size={16} />, description: 'Market data, earnings, and company filings.' },
  { id: 'twitter', label: 'Twitter / X', icon: <Twitter size={16} />, description: 'Fast-moving announcements and social sentiment.' },
  { id: 'youtube', label: 'YouTube', icon: <Youtube size={16} />, description: 'Talks, commentary, interviews, and video analysis.' },
];

const FREQ_OPTIONS: { value: 'hourly' | 'daily' | 'weekly' | 'monthly'; label: string; description: string }[] = [
  { value: 'hourly', label: 'Hourly', description: 'Best for fast-moving topics and alerts.' },
  { value: 'daily', label: 'Daily', description: 'Balanced default for ongoing monitoring.' },
  { value: 'weekly', label: 'Weekly', description: 'Good for deeper synthesis and less noise.' },
  { value: 'monthly', label: 'Monthly', description: 'High-level trend review and long horizon.' },
];

const LOOKBACK_OPTIONS: { value: 'hour' | 'day' | 'week' | 'month'; label: string; description: string }[] = [
  { value: 'hour', label: 'Hour', description: 'Use a very narrow snapshot for fast-moving events.' },
  { value: 'day', label: 'Day', description: 'Use the last 24 hours as the snapshot window.' },
  { value: 'week', label: 'Week', description: 'Use the last seven days as the snapshot window.' },
  { value: 'month', label: 'Month', description: 'Use the last 30 days as the snapshot window.' },
];

const OUTPUT_OPTIONS = [
  { id: 'briefing', label: 'HTML briefing', icon: <LayoutTemplate size={15} />, description: 'A polished web-ready report with sections, links, and callouts.' },
  { id: 'voice', label: 'Voice summary', icon: <Volume2 size={15} />, description: 'A concise spoken version for client delivery or internal review.' },
  { id: 'structured', label: 'Structured insights', icon: <FileCode2 size={15} />, description: 'Machine-friendly output for downstream automation and storage.' },
];

const DELIVERY_TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '15:00', '18:00', '20:00', '22:00'];

function getInitialCreateContext(): { projectId: string | null; projectName: string | null; returnTo: string | null } {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('projectId')?.trim() || null;
  const projectName = params.get('projectName')?.trim() || null;
  const returnTo = params.get('returnTo')?.trim() || null;

  return {
    projectId,
    projectName,
    returnTo: returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null,
  };
}

function navigateWithinApp(path: string) {
  const nextUrl = new URL(path, window.location.origin);
  window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getInitialLookbackWindow(frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'): 'hour' | 'day' | 'week' | 'month' {
  return frequency === 'hourly'
    ? 'hour'
    : frequency === 'daily'
      ? 'day'
      : frequency === 'weekly'
        ? 'week'
        : 'month';
}

interface ResearchCreatePageProps {
  onBack: () => void;
  topic?: ResearchTopic | null;
}

export function ResearchCreatePage({ onBack, topic }: ResearchCreatePageProps) {
  const initialCreateContext = useMemo(getInitialCreateContext, []);
  const isEdit = Boolean(topic);
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [sources, setSources] = useState<string[]>(topic?.sources ?? ['web', 'news']);
  const [frequency, setFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>(topic?.frequency ?? 'daily');
  const [lookbackWindow, setLookbackWindow] = useState<'hour' | 'day' | 'week' | 'month'>(topic?.lookbackWindow ?? getInitialLookbackWindow(topic?.frequency ?? 'daily'));
  const [status, setStatus] = useState<'active' | 'paused' | 'draft'>(topic?.status ?? 'active');
  const [deliveryTime, setDeliveryTime] = useState(topic?.deliveryTime ?? '08:00');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(topic?.tags ?? []);
  const [outputs, setOutputs] = useState<string[]>(topic?.outputs?.length ? topic.outputs : ['briefing', 'structured']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSource = (id: string) => {
    setSources(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const toggleOutput = (id: string) => {
    setOutputs(prev => (prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]));
  };

  const addTag = () => {
    const value = tagInput.trim().replace(/^#+/, '');
    if (value && !tags.includes(value)) {
      setTags(prev => [...prev, value]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(x => x !== tag));

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const isValid = name.trim().length > 0 && sources.length > 0;

  const handleCreate = async () => {
    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (topic) {
        await updateResearchTopic(topic.id, {
          projectId: topic.projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          frequency,
          lookbackWindow,
          status,
          deliveryTime,
          sources,
          tags,
          outputs,
        });
      } else {
        await createResearchTopic({
          requestedByUserId: getCurrentUserId(),
          projectId: initialCreateContext.projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          frequency,
          lookbackWindow,
          status,
          deliveryTime,
          sources,
          tags,
          outputs,
        });
      }
      if (initialCreateContext.returnTo) {
        navigateWithinApp(initialCreateContext.returnTo);
      } else {
        onBack();
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : `Failed to ${isEdit ? 'update' : 'create'} topic`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const preview = useMemo(() => {
    const sourceLabels = sources.map(id => SOURCE_OPTIONS.find(s => s.id === id)?.label ?? id);
    const outputLabels = outputs.map(id => OUTPUT_OPTIONS.find(o => o.id === id)?.label ?? id);

    return {
      title: name.trim() || 'Untitled research topic',
      description: description.trim() || 'Describe the thesis, market, or signal you want to track.',
      sources: sourceLabels,
      outputs: outputLabels,
      tags: tags.length > 0 ? tags : ['ai', 'research', 'monitoring'],
      cadenceCopy:
        frequency === 'hourly'
          ? 'High-frequency monitoring'
          : frequency === 'daily'
            ? 'Daily synthesis'
            : frequency === 'weekly'
              ? 'Weekly deep dive'
              : 'Monthly trend report',
      lookbackCopy:
        lookbackWindow === 'hour'
          ? 'Hourly snapshot'
          : lookbackWindow === 'day'
            ? 'Daily snapshot'
            : lookbackWindow === 'week'
              ? 'Weekly snapshot'
              : 'Monthly snapshot',
      deliveryCopy: `Delivery at ${deliveryTime}`,
    };
  }, [description, deliveryTime, frequency, lookbackWindow, name, outputs, sources, tags]);

  const handleBack = () => {
    if (initialCreateContext.returnTo) {
      navigateWithinApp(initialCreateContext.returnTo);
      return;
    }

    onBack();
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)]">
      <div className="mx-auto max-w-[1280px] px-6 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
              <Sparkles size={12} className="text-[var(--color-accent)]" />
              Research Studio
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {isEdit ? 'Edit research topic' : 'New research topic'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Define what to watch, how often to watch it, and what the system should produce:
              briefing HTML, structured output, or a voice-ready summary.
            </p>
          </div>

          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={15} />
            Back to research
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_380px]">
          <div className="space-y-5">
            <PanelCard title="Topic">
              <div className="space-y-4">
                <Field label="Topic name" helper="Give it a clear operational name, not a generic label.">
                  <input
                    type="text"
                    placeholder="e.g. AI Agents Weekly, Rival Product Watch, Market Shift Radar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  />
                </Field>

                <Field label="Intent" helper="What should this topic optimize for?">
                  <textarea
                    placeholder="Track breaking research, product launches, and credible commentary around foundation models."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  />
                </Field>
              </div>
            </PanelCard>

            <div className="grid gap-5 xl:grid-cols-2">
              <PanelCard title="Sources" subtitle={`${sources.length} selected`}>
                <div className="grid gap-2">
                  {SOURCE_OPTIONS.map((source) => {
                    const active = sources.includes(source.id);
                    return (
                      <button
                        key={source.id}
                        onClick={() => toggleSource(source.id)}
                        className="flex items-start gap-3 rounded-xl border p-3 text-left transition-all"
                        style={{
                          background: active ? 'var(--color-accent)11' : 'var(--color-bg-hover)',
                          borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                      >
                        <span className="mt-0.5" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {source.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium" style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                            {source.label}
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                            {source.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>

              <PanelCard title="Cadence" subtitle="How often should it run?">
                <div className="grid gap-2">
                  {FREQ_OPTIONS.map((item) => {
                    const active = frequency === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => setFrequency(item.value)}
                        className="rounded-xl border p-3 text-left transition-all"
                        style={{
                          background: active ? 'var(--color-accent)11' : 'var(--color-bg-hover)',
                          borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                              {item.label}
                            </div>
                            <div className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {item.description}
                            </div>
                          </div>
                          {active && <CheckCircle2 size={16} className="text-[var(--color-accent)]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>
            </div>

            <PanelCard title="Lookback window" subtitle="How far back should each run inspect?">
              <div className="grid gap-2">
                {LOOKBACK_OPTIONS.map((item) => {
                  const active = lookbackWindow === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setLookbackWindow(item.value)}
                      className="rounded-xl border p-3 text-left transition-all"
                      style={{
                        background: active ? 'var(--color-accent)11' : 'var(--color-bg-hover)',
                        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                            {item.label}
                          </div>
                          <div className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {item.description}
                          </div>
                        </div>
                        {active && <CheckCircle2 size={16} className="text-[var(--color-accent)]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </PanelCard>

            <PanelCard title="Output formats" subtitle="What should the system produce?">
              <div className="grid gap-2 xl:grid-cols-3">
                {OUTPUT_OPTIONS.map((output) => {
                  const active = outputs.includes(output.id);
                  return (
                    <button
                      key={output.id}
                      onClick={() => toggleOutput(output.id)}
                      className="flex h-full flex-col gap-3 rounded-xl border p-4 text-left transition-all"
                      style={{
                        background: active ? 'var(--color-accent)11' : 'var(--color-bg-hover)',
                        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {output.icon}
                        </span>
                        {active ? <CheckCircle2 size={16} className="text-[var(--color-accent)]" /> : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{output.label}</div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                          {output.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PanelCard>

            <div className="grid gap-5 xl:grid-cols-2">
              <PanelCard title="Delivery">
                <Field label="Delivery time" helper="When should the briefing land?">
                  <select
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  >
                    {DELIVERY_TIMES.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </Field>
              </PanelCard>

              <PanelCard title="Status">
                <Field label="Topic status" helper="Active topics are picked up by the scheduler.">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                  </select>
                </Field>
              </PanelCard>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <PanelCard title="Tags">
                <Field label="Keywords" helper="Press Enter or comma to add keywords.">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="opacity-60 transition-opacity hover:opacity-100">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {tags.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                        No tags yet. Add topics like `AI`, `policy`, `competitors`, `earnings`.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                    />
                    <button
                      onClick={addTag}
                      disabled={!tagInput.trim()}
                      className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-[var(--color-text-secondary)] transition-opacity hover:bg-[var(--color-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </Field>
              </PanelCard>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
              <div className="text-xs text-[var(--color-text-muted)]">
                This topic can later feed HTML briefs, structured data, and voice summaries.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
                <button
                  disabled={!isValid || isSubmitting}
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-black transition-opacity"
                  style={{
                    background: 'var(--color-accent)',
                    opacity: isValid && !isSubmitting ? 1 : 0.45,
                    cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isSubmitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save changes' : 'Create topic')}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-[var(--color-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Live preview</h2>
              </div>

              {initialCreateContext.projectId ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Attached project</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                    {initialCreateContext.projectName || 'Selected project'}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Topic</div>
                <div className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{preview.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{preview.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MiniStat icon={<Clock3 size={14} />} label="Cadence" value={preview.cadenceCopy} />
                <MiniStat icon={<Clock3 size={14} />} label="Lookback" value={preview.lookbackCopy} />
                <MiniStat icon={<ShieldCheck size={14} />} label="Sources" value={preview.sources.join(' · ')} />
                <MiniStat icon={<Volume2 size={14} />} label="Outputs" value={preview.outputs.join(' · ')} />
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Languages size={14} className="text-[var(--color-accent)]" />
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">What happens next</div>
                </div>
                <div className="space-y-2">
                  {[
                    'Collect source signals',
                    'Extract the relevant facts',
                    'Synthesize into briefing sections',
                    'Render HTML / structured output',
                    'Optional voice generation',
                  ].map((step, index) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[11px] font-semibold text-[var(--color-accent)]">
                        {index + 1}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">{step}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Keywords</div>
                <div className="flex flex-wrap gap-2">
                  {preview.tags.map(tag => (
                    <span key={tag} className="rounded-lg bg-[var(--color-bg-card)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{label}</div>
        {helper && <div className="text-xs text-[var(--color-text-muted)]">{helper}</div>}
      </div>
      {children}
    </label>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        <span className="text-[var(--color-accent)]">{icon}</span>
        {label}
      </div>
      <div className="text-sm leading-relaxed text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
