import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileDown,
  FolderKanban,
  Layers3,
  Lightbulb,
  MessageSquareQuote,
  MoreVertical,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  UserPlus,
  Circle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { getNotes, type NoteResponse } from '../../api/notes';
import { getProject, type ProjectResponse } from '../../api/projects';
import { getResearchList } from '../../api/research';
import { getTodos } from '../../api/todos';
import type { ResearchTopic as ApiResearchTopic, TodoItem } from '../../api/types';

type ProjectTab = 'overview' | 'notes' | 'research' | 'videos' | 'tasks';
type QuickFilter = 'all' | 'starred' | 'in-progress' | 'completed';

const VIDEO_INPUT_KINDS = new Set(['audio', 'file', 'mixed']);

function navigateTo(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function normalizeProjectStatus(status: string): 'active' | 'archived' | 'deleted' | 'unknown' {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'archived':
      return 'archived';
    case 'deleted':
      return 'deleted';
    default:
      return 'unknown';
  }
}

function projectStatusLabel(status: string): string {
  switch (normalizeProjectStatus(status)) {
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archived';
    case 'deleted':
      return 'Deleted';
    default:
      return 'Unknown';
  }
}

function projectStatusStyles(status: string): string {
  switch (normalizeProjectStatus(status)) {
    case 'active':
      return 'bg-accent/15 text-accent border-accent/20';
    case 'archived':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
    case 'deleted':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/20';
    default:
      return 'bg-bg-input text-text-secondary border-border';
  }
}

function todoStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'doing':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'done':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Open';
  }
}

function todoStatusStyles(status: string): string {
  switch (status.toLowerCase()) {
    case 'doing':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20';
    case 'blocked':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
    case 'done':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
    case 'archived':
      return 'bg-bg-input text-text-secondary border-border';
    default:
      return 'bg-bg-input text-text-secondary border-border';
  }
}

function formatRelative(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (absMinutes < 1) return 'just now';
  if (absMinutes < 60) return `${absMinutes}m ago`;
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return `${absHours}h ago`;
  const absDays = Math.round(absHours / 24);
  return `${absDays}d ago`;
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function renderProjectIcon(key?: string | null): ReactNode {
  switch (key) {
    case 'Sparkles':
      return <Sparkles size={18} />;
    case 'Target':
      return <Target size={18} />;
    case 'Layers3':
      return <Layers3 size={18} />;
    case 'MessageSquareQuote':
      return <MessageSquareQuote size={18} />;
    case 'Lightbulb':
      return <Lightbulb size={18} />;
    case 'Play':
      return <Play size={18} />;
    case 'FolderKanban':
    default:
      return <FolderKanban size={18} />;
  }
}

function initialsFrom(value?: string | null): string {
  const source = (value?.trim() || 'AN').toUpperCase();
  return source.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2);
}

function isVideoNote(note: NoteResponse): boolean {
  return VIDEO_INPUT_KINDS.has(note.inputKind.toLowerCase());
}

function compareUpdatedDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function compareCreatedDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function compareAnyUpdatedDesc(a: { updatedAt?: string | null; createdAt?: string | null; date?: string | null }, b: { updatedAt?: string | null; createdAt?: string | null; date?: string | null }): number {
  const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? a.date ?? '');
  const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? b.date ?? '');
  return bTime - aTime;
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>;
}

function SectionCard({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        {actionLabel ? (
          onAction ? (
            <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover">
              {actionLabel}
              <ArrowRight size={12} />
            </button>
          ) : (
            <span className="text-[11px] font-medium text-text-secondary">{actionLabel}</span>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
          <div className="mt-1.5 text-[26px] font-semibold tracking-tight text-text-primary">{value}</div>
          <div className="mt-1 text-[11px] text-text-secondary">{sub}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-bg-primary/60" style={{ color: accent }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="text-[12px] text-text-secondary">{label}</div>
      <div className="text-right text-[12px] font-medium text-text-primary">{value}</div>
    </div>
  );
}

function ItemRow({
  icon,
  title,
  meta,
  time,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  time?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-input text-accent">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-text-primary">{title}</div>
        {meta ? <div className="truncate text-[11px] text-text-secondary">{meta}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {time ? <div className="text-[10px] text-text-muted">{time}</div> : null}
        {trailing}
      </div>
    </div>
  );
}

export default function ProjectViewPage({
  projectId,
  onBack,
  currentUserDisplayName,
  currentUserEmail,
}: {
  projectId: string;
  onBack: () => void;
  currentUserDisplayName?: string | null;
  currentUserEmail?: string | null;
}) {
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [notes, setNotes] = useState<NoteResponse[]>([]);
  const [researchTopics, setResearchTopics] = useState<ApiResearchTopic[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getProject(projectId),
      getNotes({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 }),
      getResearchList(getCurrentUserId()),
      getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 }),
    ])
      .then(([projectData, noteList, researchList, todoList]) => {
        if (!mounted) return;
        setProject(projectData);
        setNotes(noteList);
        setResearchTopics(researchList.topics.filter((topic) => topic.projectId === projectId));
        setTodos(todoList.items);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    setActiveTab('overview');
    setQuickFilter('all');
  }, [projectId]);

  const metrics = useMemo(() => {
    const videoNotes = notes.filter(isVideoNote);
    const doneTasks = todos.filter((todo) => todo.status === 'done').length;
    const doingTasks = todos.filter((todo) => todo.status === 'doing').length;
    const activeResearch = researchTopics.filter((topic) => topic.status === 'active').length;
    const completedResearch = researchTopics.filter((topic) => topic.status === 'draft').length;

    return {
      notesCount: notes.length,
      researchCount: researchTopics.length,
      videoCount: videoNotes.length,
      taskCount: todos.length,
      doneTasks,
      doingTasks,
      activeResearch,
      completedResearch,
      totalItems: notes.length + researchTopics.length + todos.length,
      completion: todos.length > 0 ? Math.round((doneTasks / todos.length) * 100) : Math.min(92, Math.max(18, Math.round(((notes.length + researchTopics.length + videoNotes.length) / 30) * 100))),
    };
  }, [notes, researchTopics, todos]);

  const projectAccent = project?.color ?? '#00d4aa';
  const selectedProjectIcon = renderProjectIcon(project?.icon);
  const projectTags = useMemo(() => {
    if (!project) return [];
    return [
      ...(project.aliases ?? []).slice(0, 3),
      project.isDefault ? 'Default workspace' : null,
      project.status === 'active' ? 'Active' : null,
    ].filter((item): item is string => Boolean(item));
  }, [project]);

  const noteItems = useMemo(() => notes.slice().sort(compareUpdatedDesc).slice(0, 4), [notes]);
  const researchItems = useMemo(() => researchTopics.slice().sort(compareUpdatedDesc).slice(0, 4), [researchTopics]);
  const videoItems = useMemo(() => notes.filter(isVideoNote).slice().sort(compareUpdatedDesc).slice(0, 3), [notes]);
  const taskItems = useMemo(() => todos.slice().sort((a, b) => (a.sortOrder - b.sortOrder) || compareCreatedDesc(a, b)).slice(0, 5), [todos]);
  const activityItems = useMemo(() => {
    const noteEntries = notes.map((note) => ({
      id: `note-${note.id}`,
      title: note.title,
      meta: `${note.sourceChannel} · ${note.inputKind}`,
      time: formatRelative(note.updatedAt),
      date: note.updatedAt,
      icon: <MessageSquareQuote size={14} />,
      color: '#00d4aa',
      kind: 'note',
    }));
    const researchEntries = researchTopics.map((topic) => ({
      id: `research-${topic.id}`,
      title: topic.name,
      meta: topic.description || 'Research topic',
      time: formatRelative(topic.updatedAt),
      date: topic.updatedAt,
      icon: <Sparkles size={14} />,
      color: '#a78bfa',
      kind: 'research',
    }));
    const todoEntries = todos.map((todo) => ({
      id: `todo-${todo.id}`,
      title: todo.title,
      meta: todo.projectName ? todo.projectName : 'Task',
      time: formatRelative(todo.updatedAt),
      date: todo.updatedAt,
      icon: todo.status === 'done' ? <CheckCircle2 size={14} /> : <Circle size={14} />,
      color: todo.status === 'done' ? '#34d399' : '#4dc8e8',
      kind: 'todo',
    }));

    return [...noteEntries, ...researchEntries, ...todoEntries].sort(compareAnyUpdatedDesc).slice(0, 6);
  }, [notes, researchTopics, todos]);

  const filteredActivity = useMemo(() => {
    if (quickFilter === 'all') return activityItems;
    if (quickFilter === 'starred') {
      return activityItems.filter((item) => item.kind === 'research' || item.kind === 'note');
    }
    if (quickFilter === 'in-progress') {
      return activityItems.filter((item) => item.kind === 'research' || item.kind === 'todo');
    }
    return activityItems.filter((item) => item.kind === 'todo');
  }, [activityItems, quickFilter]);

  const ownerName = currentUserDisplayName?.trim() || currentUserEmail?.trim() || 'Owner';
  const ownerInitials = initialsFrom(ownerName);

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="mx-auto max-w-[1600px] px-5 py-5 animate-pulse">
          <div className="h-[220px] rounded-[24px] border border-border bg-bg-card" />
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="h-[90px] rounded-[22px] border border-border bg-bg-card" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-[120px] rounded-[22px] border border-border bg-bg-card" />)}
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[240px] rounded-[22px] border border-border bg-bg-card" />)}
              </div>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
                <div className="h-[320px] rounded-[22px] border border-border bg-bg-card" />
                <div className="h-[320px] rounded-[22px] border border-border bg-bg-card" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-[340px] rounded-[22px] border border-border bg-bg-card" />
              <div className="h-[220px] rounded-[22px] border border-border bg-bg-card" />
              <div className="h-[250px] rounded-[22px] border border-border bg-bg-card" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="mx-auto max-w-[1600px] px-5 py-5">
          <section className="rounded-[24px] border border-border bg-bg-card p-6">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[11px] font-medium text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft size={14} />
              Back to Projects
            </button>
            <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-red-300">
              {error || 'Project not found.'}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const tabItems: Array<{ id: ProjectTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes' },
    { id: 'research', label: 'Research' },
    { id: 'videos', label: 'Videos' },
    { id: 'tasks', label: 'Tasks' },
  ];

  const rightQuickFilterItems = [
    { id: 'all' as const, label: 'All items', count: metrics.totalItems, icon: <Search size={14} /> },
    { id: 'starred' as const, label: 'Starred', count: Math.max(0, researchTopics.filter((topic) => topic.status === 'active').length + notes.filter((note) => Boolean(note.summary)).length), icon: <Star size={14} /> },
    { id: 'in-progress' as const, label: 'In progress', count: metrics.doingTasks + metrics.activeResearch, icon: <Clock3 size={14} /> },
    { id: 'completed' as const, label: 'Completed', count: metrics.doneTasks, icon: <CheckCircle2 size={14} /> },
  ];

  const heroActions = [
    { label: 'Add note', icon: <MessageSquareQuote size={14} />, action: () => navigateTo('/notes') },
    { label: 'Start research', icon: <Sparkles size={14} />, action: () => navigateTo('/research/create') },
    { label: 'Import video', icon: <Play size={14} />, action: () => navigateTo('/') },
    { label: 'Add task', icon: <Plus size={14} />, action: () => navigateTo('/todo') },
  ];

  const isOverview = activeTab === 'overview';
  const showNotes = isOverview || activeTab === 'notes';
  const showResearch = isOverview || activeTab === 'research';
  const showVideos = isOverview || activeTab === 'videos';
  const showTasks = isOverview || activeTab === 'tasks';

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[1600px] px-5 py-5">
        <section className="rounded-[24px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.12),rgba(19,28,48,0.96)_45%,rgba(12,18,33,1))] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3 text-[12px] text-text-secondary">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 hover:text-text-primary">
              <ArrowLeft size={14} />
              Back to Projects
            </button>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-text-muted">Project workspace</span>
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border" style={{ backgroundColor: `${projectAccent}18`, color: projectAccent }}>
                  {selectedProjectIcon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-[28px] font-semibold tracking-tight text-text-primary">{project.name}</h1>
                    <Star size={15} className="text-text-secondary" />
                  </div>
                  <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
                    {project.description ?? 'Central hub for tracking this project, related research, and work items.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusChip label={projectStatusLabel(project.status)} className={projectStatusStyles(project.status)} />
                {project.isDefault ? <StatusChip label="Default workspace" className="bg-bg-input text-text-secondary border-border" /> : null}
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">{ownerInitials}</span>
                  <span className="font-medium text-text-primary">{ownerName}</span>
                  <span>Owner</span>
                </span>
                {projectTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {heroActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.action}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                >
                  <span className="text-accent">{action.icon}</span>
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-card text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                aria-label="More actions"
              >
                <MoreVertical size={14} />
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-5 border-t border-border pt-4">
            {tabItems.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-2 text-[13px] font-medium transition-colors ${active ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {tab.label}
                  <span className={`absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full ${active ? 'bg-accent' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Notes" value={formatCount(metrics.notesCount)} sub={`${formatCount(notes.filter((note) => Boolean(note.summary)).length)} with summaries`} icon={<FolderKanban size={15} />} accent="#00d4aa" />
              <StatCard label="Research items" value={formatCount(metrics.researchCount)} sub={`${formatCount(metrics.activeResearch)} active`} icon={<Sparkles size={15} />} accent="#a78bfa" />
              <StatCard label="Videos / summaries" value={formatCount(metrics.videoCount)} sub={`${formatCount(metrics.videoCount)} imported or transcribed`} icon={<Play size={15} />} accent="#4dc8e8" />
              <StatCard label="Tasks" value={formatCount(metrics.taskCount)} sub={`${formatCount(metrics.doneTasks)} completed`} icon={<Target size={15} />} accent="#60a5fa" />
            </div>

            {showNotes && (
              <SectionCard title="Recent notes" actionLabel="View all" onAction={() => navigateTo('/notes')}>
                <div className="divide-y divide-border">
                  {noteItems.length === 0 ? (
                    <div className="px-1 py-6 text-center text-[12px] text-text-muted">No notes in this project yet.</div>
                  ) : (
                    noteItems.map((note) => (
                      <ItemRow
                        key={note.id}
                        icon={<MessageSquareQuote size={14} />}
                        title={note.title}
                        meta={`${note.sourceChannel} · ${note.inputKind}${note.summary ? ` · ${note.summary}` : ''}`}
                        time={formatRelative(note.updatedAt)}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {showResearch && (
              <SectionCard title="Research" actionLabel="View all" onAction={() => navigateTo('/research')}>
                <div className="divide-y divide-border">
                  {researchItems.length === 0 ? (
                    <div className="px-1 py-6 text-center text-[12px] text-text-muted">No research topics in this project yet.</div>
                  ) : (
                    researchItems.map((topic) => (
                      <ItemRow
                        key={topic.id}
                        icon={<Sparkles size={14} />}
                        title={topic.name}
                        meta={`${topic.description || 'Research topic'} · ${topic.status}`}
                        time={formatRelative(topic.updatedAt)}
                        trailing={<StatusChip label={topic.status} className={topic.status === 'active' ? 'bg-accent/15 text-accent border-accent/20' : 'bg-bg-input text-text-secondary border-border'} />}
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('/research/create')}
                  className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium text-accent hover:text-accent-hover"
                >
                  <Plus size={12} />
                  Start new research
                </button>
              </SectionCard>
            )}

            {showVideos && (
              <SectionCard title="Videos / YouTube summaries" actionLabel="View all" onAction={() => navigateTo('/')}>
                <div className="divide-y divide-border">
                  {videoItems.length === 0 ? (
                    <div className="px-1 py-6 text-center text-[12px] text-text-muted">No videos linked to this project yet.</div>
                  ) : (
                    videoItems.map((note) => (
                      <ItemRow
                        key={note.id}
                        icon={<Play size={14} />}
                        title={note.title}
                        meta={`${note.sourceChannel} · ${note.inputKind}`}
                        time={formatRelative(note.updatedAt)}
                        trailing={<StatusChip label="Summarized" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20" />}
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('/')}
                  className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium text-accent hover:text-accent-hover"
                >
                  <Plus size={12} />
                  Import new video
                </button>
              </SectionCard>
            )}

            {showTasks && (
              <SectionCard title="Tasks" actionLabel="View all" onAction={() => navigateTo('/todo')}>
                <div className="divide-y divide-border">
                  {taskItems.length === 0 ? (
                    <div className="px-1 py-6 text-center text-[12px] text-text-muted">No tasks in this project yet.</div>
                  ) : (
                    taskItems.map((todo) => (
                      <ItemRow
                        key={todo.id}
                        icon={todo.status === 'done' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        title={todo.title}
                        meta={`${todo.priority} priority${todo.description ? ` · ${todo.description}` : ''}`}
                        time={todo.dueAt ? formatShortDate(todo.dueAt) : formatRelative(todo.updatedAt)}
                        trailing={<StatusChip label={todoStatusLabel(todo.status)} className={todoStatusStyles(todo.status)} />}
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('/todo')}
                  className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium text-accent hover:text-accent-hover"
                >
                  <Plus size={12} />
                  Add new task
                </button>
              </SectionCard>
            )}

            <SectionCard title="Activity feed" actionLabel="View all">
              <div className="divide-y divide-border">
                {filteredActivity.length === 0 ? (
                  <div className="px-1 py-6 text-center text-[12px] text-text-muted">No activity yet.</div>
                ) : (
                  filteredActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-text-primary">{item.title}</div>
                        <div className="truncate text-[11px] text-text-secondary">{item.meta}</div>
                      </div>
                      <div className="text-[10px] text-text-muted">{item.time}</div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="About this project">
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-[12px] text-text-secondary">
                  <span>Progress</span>
                  <span className="font-medium text-text-primary">{metrics.completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-input overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${metrics.completion}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {formatCount(metrics.doneTasks)} / {formatCount(Math.max(metrics.taskCount, 1))} tasks completed
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {projectTags.length === 0 ? (
                  <span className="text-[12px] text-text-muted">No tags yet.</span>
                ) : (
                  projectTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border bg-bg-input px-2 py-1 text-[11px] text-text-secondary">
                      {tag}
                    </span>
                  ))
                )}
              </div>

              <div className="divide-y divide-border rounded-2xl border border-border bg-bg-primary/40 px-3">
                <DetailRow label="Created" value={formatShortDate(project.createdAt)} />
                <DetailRow label="Last updated" value={formatShortDate(project.updatedAt)} />
                <DetailRow label="Owner" value={ownerName} />
                <DetailRow label="Workspace" value={project.isDefault ? 'Default workspace' : 'Shared workspace'} />
                <DetailRow label="Visibility" value="Private" />
              </div>
            </SectionCard>

            <SectionCard title="Quick filters">
              <div className="space-y-2">
                {rightQuickFilterItems.map((item) => {
                  const active = quickFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setQuickFilter(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                        active ? 'border-accent/30 bg-accent/10 text-text-primary' : 'border-border bg-bg-primary/40 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 text-[12px]">
                        <span className={active ? 'text-accent' : 'text-text-muted'}>{item.icon}</span>
                        {item.label}
                      </span>
                      <span className="text-[12px] font-medium">{formatCount(item.count)}</span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Shortcuts">
              <div className="space-y-2">
                {[
                  { label: 'Project settings', icon: <Settings size={14} />, action: () => navigateTo('/settings') },
                  { label: 'Invite collaborators', icon: <UserPlus size={14} />, action: () => navigateTo('/profile') },
                  { label: 'Export project data', icon: <FileDown size={14} />, action: () => navigateTo('/exports') },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-bg-primary/40 px-3 py-2 text-left text-[12px] text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-accent">{item.icon}</span>
                      {item.label}
                    </span>
                    <ArrowRight size={12} className="text-text-muted" />
                  </button>
                ))}
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-left text-[12px] text-rose-300 transition-colors hover:bg-rose-500/15"
                  aria-disabled="true"
                >
                  <span className="inline-flex items-center gap-2">
                    <Archive size={14} />
                    Archive this project
                  </span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}
