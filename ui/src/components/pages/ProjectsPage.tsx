import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  ExternalLink,
  FolderKanban,
  LayoutGrid,
  Lightbulb,
  Layers3,
  List,
  MessageSquareQuote,
  MoreVertical,
  PenTool,
  Play,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { getNotes, type NoteResponse } from '../../api/notes';
import { createProject, getProjects, type ProjectResponse } from '../../api/projects';
import { getResearchList } from '../../api/research';
import type { ResearchTopic } from '../../api/types';

type ProjectStatus = 'active' | 'archived' | 'deleted' | 'unknown';
type ListLayout = 'grid' | 'list';
type ProjectFilter = 'all' | 'active' | 'archived';
type OwnerFilter = 'all' | 'mine';
type SortOption = 'recent' | 'name' | 'notes';

type ProjectCardModel = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  notesCount: number;
  researchCount: number;
  videoCount: number;
  updatedAt: string;
  updatedLabel: string;
  accent: string;
  icon: ReactNode;
  tags: string[];
  isDefault: boolean;
  isOwner: boolean;
};

type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  time: string;
  accent: string;
  icon: ReactNode;
};

const PROJECT_COLOR_OPTIONS = [
  { label: 'Teal', value: '#00d4aa' },
  { label: 'Cyan', value: '#4dc8e8' },
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Indigo', value: '#818cf8' },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Coral', value: '#fb923c' },
  { label: 'Mint', value: '#2dd4bf' },
  { label: 'Lavender', value: '#c084fc' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Slate', value: '#94a3b8' },
] as const;

const PROJECT_ICON_OPTIONS = [
  { key: 'FolderKanban', label: 'Workspace', Icon: FolderKanban },
  { key: 'Sparkles', label: 'Ideas', Icon: Sparkles },
  { key: 'Target', label: 'Goals', Icon: Target },
  { key: 'Layers3', label: 'Systems', Icon: Layers3 },
  { key: 'MessageSquareQuote', label: 'Notes', Icon: MessageSquareQuote },
  { key: 'Compass', label: 'Direction', Icon: Compass },
  { key: 'Rocket', label: 'Launch', Icon: Rocket },
  { key: 'Lightbulb', label: 'Insights', Icon: Lightbulb },
  { key: 'PenTool', label: 'Writing', Icon: PenTool },
] as const;

const VIDEO_INPUT_KINDS = new Set(['audio', 'file', 'mixed']);

function navigateTo(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function normalizeProjectStatus(status: string): ProjectStatus {
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

function statusLabel(status: ProjectStatus): string {
  switch (status) {
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

function statusStyles(status: ProjectStatus): string {
  switch (status) {
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

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function fallbackAccent(index: number): string {
  return ['#00d4aa', '#38bdf8', '#f59e0b', '#a78bfa', '#fb7185', '#34d399'][index % 6];
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
    case 'Compass':
      return <Compass size={18} />;
    case 'Rocket':
      return <Rocket size={18} />;
    case 'Lightbulb':
      return <Lightbulb size={18} />;
    case 'PenTool':
      return <PenTool size={18} />;
    case 'FolderKanban':
    default:
      return <FolderKanban size={18} />;
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [notes, setNotes] = useState<NoteResponse[]>([]);
  const [researchTopics, setResearchTopics] = useState<ResearchTopic[]>([]);
  const [researchStats, setResearchStats] = useState({
    activeTopics: 0,
    briefingsGenerated: 0,
    sourcesTracked: 0,
    avgReadTime: '0 min',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    color: '#00d4aa',
    icon: 'FolderKanban',
    isDefault: false,
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [layout, setLayout] = useState<ListLayout>('grid');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getProjects(getCurrentUserId()),
      getNotes({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
      getResearchList(getCurrentUserId()),
    ])
      .then(([projectList, noteList, researchList]) => {
        if (!mounted) return;
        setProjects(projectList);
        setNotes(noteList);
        setResearchTopics(researchList.topics);
        setResearchStats(researchList.stats);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refreshData = async (nextOpen?: boolean) => {
    const [projectList, noteList, researchList] = await Promise.all([
      getProjects(getCurrentUserId()),
      getNotes({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
      getResearchList(getCurrentUserId()),
    ]);
    setProjects(projectList);
    setNotes(noteList);
    setResearchTopics(researchList.topics);
    setResearchStats(researchList.stats);
    if (nextOpen) {
      setCreateOpen(true);
    }
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim() || createSaving) return;
    setCreateSaving(true);
    setCreateError(null);

    try {
      await createProject({
        requestedByUserId: getCurrentUserId(),
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        color: createForm.color || null,
        icon: createForm.icon || null,
        isDefault: createForm.isDefault,
      });
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', color: '#00d4aa', icon: 'FolderKanban', isDefault: false });
      await refreshData(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreateSaving(false);
    }
  };

  const projectCards = useMemo<ProjectCardModel[]>(() => {
    const currentUserId = getCurrentUserId();
    const projectNotes = new Map<string, NoteResponse[]>();
    const projectResearch = new Map<string, ResearchTopic[]>();

    for (const note of notes) {
      if (!note.projectId) continue;
      const bucket = projectNotes.get(note.projectId) ?? [];
      bucket.push(note);
      projectNotes.set(note.projectId, bucket);
    }

    for (const topic of researchTopics) {
      if (!topic.projectId) continue;
      const bucket = projectResearch.get(topic.projectId) ?? [];
      bucket.push(topic);
      projectResearch.set(topic.projectId, bucket);
    }

    const visibleProjects = projects
      .filter((project) => {
        const status = normalizeProjectStatus(project.status);
        if (status === 'deleted') return false;
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (ownerFilter === 'mine' && project.requestedByUserId !== currentUserId) return false;

        const search = query.trim().toLowerCase();
        if (!search) return true;

        const projectTags = [
          project.name,
          project.description ?? '',
          ...(project.aliases ?? []),
        ].join(' ').toLowerCase();

        return projectTags.includes(search);
      })
      .map((project, index) => {
        const projectNoteList = projectNotes.get(project.id) ?? [];
        const projectResearchList = projectResearch.get(project.id) ?? [];
        const latestNote = [...projectNoteList].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
        const latestResearch = [...projectResearchList].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
        const updatedAt = [project.updatedAt, latestNote?.updatedAt ?? null, latestResearch?.updatedAt ?? null]
          .filter(Boolean)
          .sort((a, b) => Date.parse(b!) - Date.parse(a!))[0] ?? project.updatedAt;
        const noteCount = projectNoteList.length;
        const researchCount = projectResearchList.length;
        const videoCount = projectNoteList.filter((note) => VIDEO_INPUT_KINDS.has(note.inputKind.toLowerCase())).length;
        const tags = [
          ...(project.aliases ?? []).slice(0, 2),
          noteCount > 0 ? 'Notes' : null,
          researchCount > 0 ? 'Research' : null,
          videoCount > 0 ? 'YouTube' : null,
          project.isDefault ? 'Default' : null,
        ].filter((tag): tag is string => Boolean(tag));

        return {
          id: project.id,
          name: project.name,
          description: project.description ?? 'No description yet.',
          status: normalizeProjectStatus(project.status),
          notesCount: noteCount,
          researchCount,
          videoCount,
          updatedAt,
          updatedLabel: formatRelative(updatedAt),
          accent: project.color ?? fallbackAccent(index),
          icon: renderProjectIcon(project.icon),
          tags: tags.slice(0, 4),
          isDefault: project.isDefault,
          isOwner: project.requestedByUserId === currentUserId,
        };
      });

    if (sortBy === 'name') {
      visibleProjects.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'notes') {
      visibleProjects.sort((a, b) => b.notesCount - a.notesCount);
    } else {
      visibleProjects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }

    return visibleProjects;
  }, [notes, ownerFilter, projects, query, researchTopics, sortBy, statusFilter]);

  const heroStats = useMemo(() => {
    const activeProjects = projectCards.filter((project) => project.id !== 'inbox' && project.status === 'active').length;
    const recentNotes = notes.filter((note) => Date.now() - Date.parse(note.updatedAt) < 1000 * 60 * 60 * 24 * 7).length;
    const researchItems = researchStats.briefingsGenerated || researchTopics.length;
    const videoSummaries = notes.filter((note) => VIDEO_INPUT_KINDS.has(note.inputKind.toLowerCase())).length;

    return [
      { label: 'Active projects', value: formatCount(activeProjects), detail: 'Live workspaces', icon: <FolderKanban size={15} />, accent: '#00d4aa' },
      { label: 'Recent notes', value: formatCount(recentNotes), detail: 'Updated this week', icon: <MessageSquareQuote size={15} />, accent: '#4dc8e8' },
      { label: 'Research items', value: formatCount(researchItems), detail: `${formatCount(researchStats.activeTopics)} topics tracked`, icon: <Sparkles size={15} />, accent: '#a78bfa' },
      { label: 'Video summaries', value: formatCount(videoSummaries), detail: 'Imported or transcribed', icon: <Play size={15} />, accent: '#38bdf8' },
    ];
  }, [notes, projectCards, researchStats.activeTopics, researchStats.briefingsGenerated, researchTopics.length]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const projectById = new Map<string, ProjectResponse>(projects.map((project) => [project.id, project]));
    const noteItems = notes.map((note) => ({
      id: `note-${note.id}`,
      sort: Date.parse(note.updatedAt),
      title: note.projectName ? `${note.projectName}: ${note.title}` : note.title,
      meta: `${note.sourceChannel} · ${note.inputKind}`,
      time: formatRelative(note.updatedAt),
      accent: '#00d4aa',
      icon: <MessageSquareQuote size={16} />,
    }));
    const researchItems = researchTopics.map((topic) => ({
      id: `research-${topic.id}`,
      sort: Date.parse(topic.updatedAt),
      title: topic.name,
      meta: `${topic.projectId ? projectById.get(topic.projectId)?.name ?? 'Project-linked research' : 'Research topic'} · ${topic.status}`,
      time: formatRelative(topic.updatedAt),
      accent: '#a78bfa',
      icon: <Sparkles size={16} />,
    }));

    return [...noteItems, ...researchItems]
      .sort((a, b) => b.sort - a.sort)
      .slice(0, 5)
      .map(({ id, title, meta, time, accent, icon }) => ({
        id,
        title,
        meta,
        time,
        accent,
        icon,
      }));
  }, [notes, projects, researchTopics]);

  const howItWorks = [
    {
      title: 'Capture',
      description: 'Add notes, start research, or import YouTube videos.',
      icon: <Sparkles size={16} />,
      accent: '#a855f7',
    },
    {
      title: 'Organize',
      description: 'Group everything in a project that fits your goals.',
      icon: <FolderKanban size={16} />,
      accent: '#00d4aa',
    },
    {
      title: 'Connect',
      description: 'Notes, research, and summaries stay linked and searchable.',
      icon: <Layers3 size={16} />,
      accent: '#60a5fa',
    },
    {
      title: 'Create',
      description: 'Move from raw captures to insights, exports, and deliverables.',
      icon: <Lightbulb size={16} />,
      accent: '#34d399',
    },
  ];

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="mx-auto max-w-[1600px] px-5 py-5 animate-pulse">
          <div className="h-[176px] rounded-[24px] border border-border bg-bg-card" />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-[94px] rounded-[20px] border border-border bg-bg-card" />)}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="h-[540px] rounded-[22px] border border-border bg-bg-card" />
              <div className="h-[220px] rounded-[22px] border border-border bg-bg-card" />
            </div>
            <div className="space-y-4">
              <div className="h-[240px] rounded-[22px] border border-border bg-bg-card" />
              <div className="h-[190px] rounded-[22px] border border-border bg-bg-card" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[1600px] px-5 py-5">
        <section className="rounded-[22px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.12),rgba(19,28,48,0.96)_45%,rgba(12,18,33,1))] p-4.5 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[24px] font-semibold tracking-tight text-text-primary">Projects</h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
                Organize your notes, research, and YouTube summaries in one place.
                Keep everything connected, searchable, and ready when you need it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
              >
                <Plus size={14} />
                New project
              </button>
              <button
                onClick={() => navigateTo('/notes')}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              >
                <MessageSquareQuote size={14} className="text-accent" />
                Quick note
              </button>
              <button
                onClick={() => navigateTo('/research/create')}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              >
                <Sparkles size={14} className="text-accent" />
                Start research
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-card text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                aria-label="More actions"
              >
                <MoreVertical size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12px] text-red-300">
                {error}
              </div>
            )}

            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,auto))]">
              <label className="flex items-center gap-2.5 rounded-2xl border border-border bg-bg-card px-3.5 py-2.5">
                <Search size={15} className="text-text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProjectFilter)}
                className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
              >
                <option value="all">All projects</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
                className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
              >
                <option value="all">All owners</option>
                <option value="mine">Mine</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
              >
                <option value="recent">Sort: Recent activity</option>
                <option value="name">Sort: Name</option>
                <option value="notes">Sort: Notes</option>
              </select>

              <div className="flex items-center rounded-2xl border border-border bg-bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setLayout('grid')}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    layout === 'grid' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
                  }`}
                  aria-label="Grid layout"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('list')}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    layout === 'list' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
                  }`}
                  aria-label="List layout"
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {heroStats.map((stat) => (
                <MetricCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  detail={stat.detail}
                  icon={stat.icon}
                  accent={stat.accent}
                />
              ))}
            </div>

            <section className="rounded-[22px] border border-border bg-bg-card p-4">
              <div className="mb-3.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-text-primary">Your projects</h2>
                  <p className="mt-1 text-[12px] text-text-secondary">
                    {projectCards.length === 1 ? '1 workspace is visible.' : `${formatCount(projectCards.length)} workspaces are visible.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter((current) => (current === 'archived' ? 'all' : 'archived'))}
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  View archived
                  <ArrowRight size={12} />
                </button>
              </div>

              {layout === 'grid' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {projectCards.map((project) => (
                      <ProjectCard key={project.id} project={project} layout="grid" />
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-4">
                    <CreateProjectTile onClick={() => setCreateOpen(true)} className="xl:col-span-1" />
                    <section className="rounded-[22px] border border-border bg-bg-card p-4 xl:col-span-3">
                      <div className="mb-3.5 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-[15px] font-semibold text-text-primary">Recent activity</h2>
                          <p className="mt-1 text-[12px] text-text-secondary">Latest changes across your workspaces.</p>
                        </div>
                        <button className="rounded-xl border border-border bg-bg-input px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                          View all activity
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-[18px] border border-border">
                        {recentActivity.length === 0 ? (
                          <div className="px-4 py-8 text-center text-[12px] text-text-muted">No recent activity yet.</div>
                        ) : (
                          <div className="divide-y divide-border">
                            {recentActivity.map((item) => (
                              <div key={item.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3">
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: `${item.accent}18`, color: item.accent }}
                                >
                                  {item.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-medium text-text-primary">{item.title}</div>
                                  <div className="truncate text-[11px] text-text-secondary">{item.meta}</div>
                                </div>
                                <div className="text-[10px] text-text-muted">{item.time}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectCards.map((project) => (
                    <ProjectCard key={project.id} project={project} layout="list" />
                  ))}
                  <CreateProjectTile onClick={() => setCreateOpen(true)} list />
                </div>
              )}

              {projectCards.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] text-text-muted">
                  No projects match the current filters.
                </div>
              )}
            </section>

          </div>

          <aside className="space-y-4">
            <SidebarCard title="How projects work" accent="#a855f7" actionLabel="Hide">
              <div className="space-y-2.5">
                {howItWorks.map((step, index) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-input" style={{ color: step.accent }}>
                        {step.icon}
                      </div>
                      {index < howItWorks.length - 1 && <div className="mt-2 h-7 w-px bg-border" />}
                    </div>
                    <div className="pb-1.5">
                      <div className="text-[12px] font-semibold text-text-primary">{step.title}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigateTo('/research')}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              >
                Learn more
                <ExternalLink size={13} />
              </button>
            </SidebarCard>

            <SidebarCard title="Quick start" accent="#00d4aa">
              <div className="space-y-1.5">
                {[
                  { label: 'Add a quick note', action: () => navigateTo('/notes'), icon: <MessageSquareQuote size={13} /> },
                  { label: 'Start new research', action: () => navigateTo('/research/create'), icon: <Sparkles size={13} /> },
                  { label: 'Import YouTube video', action: () => navigateTo('/'), icon: <Play size={13} /> },
                  { label: 'Create project from template', action: () => setCreateOpen(true), icon: <FolderKanban size={13} /> },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-bg-input px-3 py-2 text-left text-[11px] text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-accent">{item.icon}</span>
                      {item.label}
                    </span>
                    <Plus size={14} className="text-text-muted" />
                  </button>
                ))}
              </div>
            </SidebarCard>

            <SidebarCard title="Tip" accent="#34d399">
              <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3.5 text-[12px] leading-relaxed text-text-secondary">
                Use projects to keep related notes, research, and summaries together so you spend less time searching and more time creating.
              </div>
            </SidebarCard>
          </aside>
        </section>
      </div>

      {createOpen && (
        <ProjectCreateModal
          form={createForm}
          saving={createSaving}
          error={createError}
          onClose={() => setCreateOpen(false)}
          onChange={setCreateForm}
          onSubmit={handleCreateProject}
        />
      )}
    </main>
  );
}

function ProjectCard({
  project,
  layout,
}: {
  project: ProjectCardModel;
  layout: ListLayout;
}) {
  const isList = layout === 'list';

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
      onClick={() => navigateTo(`/projects/${encodeURIComponent(project.id)}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateTo(`/projects/${encodeURIComponent(project.id)}`);
        }
      }}
      className={`cursor-pointer rounded-2xl border border-border bg-bg-card p-4 transition-all hover:border-accent/30 hover:bg-bg-card-hover ${isList ? 'min-h-[180px]' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border"
          style={{ backgroundColor: `${project.accent}18`, color: project.accent }}
        >
          {project.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">Project</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyles(project.status)}`}>
              {statusLabel(project.status)}
            </span>
            {project.isDefault && (
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                Default
              </span>
            )}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="text-text-muted transition-colors hover:text-text-primary"
              aria-label={`More options for ${project.name}`}
            >
              <MoreVertical size={14} />
            </button>
          </div>

          <h3 className="mt-1.5 text-[15px] font-semibold text-text-primary">{project.name}</h3>
          <p className="mt-1.5 min-h-[40px] text-[11px] leading-relaxed text-text-secondary">{project.description}</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <InfoPill label="Notes" value={formatCount(project.notesCount)} />
            <InfoPill label="Research" value={formatCount(project.researchCount)} />
            <InfoPill label="Videos" value={formatCount(project.videoCount)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-bg-input px-2 py-0.75 text-[10px] text-text-secondary">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={11} />
              Updated {project.updatedLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-accent">
              Open
              <ArrowRight size={11} />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CreateProjectTile({ onClick, list = false, className = '' }: { onClick: () => void; list?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border border-dashed border-border bg-bg-primary/40 text-left transition-colors hover:border-accent/30 hover:bg-bg-card ${
        list ? 'px-4 py-3.5' : 'px-4 py-6'
      } ${className}`}
    >
      <div className={`flex ${list ? 'items-center justify-between' : 'flex-col items-center text-center'} gap-4`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-input text-text-secondary">
          <Plus size={16} />
        </div>
        <div className={list ? 'min-w-0 flex-1' : ''}>
          <div className="text-[13px] font-semibold text-text-primary">Create new project</div>
          <div className={`mt-1 text-[12px] leading-relaxed text-text-secondary ${list ? 'max-w-xl' : 'max-w-[220px]'}`}>
            Bring your notes, research, and summaries together.
          </div>
        </div>
        {list && <ArrowRight size={15} className="text-accent" />}
      </div>
    </button>
  );
}

function SidebarCard({
  title,
  accent,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  accent: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-border bg-bg-card p-4">
      <div className="mb-3.5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {actionLabel ? (
            onAction ? (
              <button type="button" onClick={onAction} className="text-[11px] text-text-secondary transition-colors hover:text-text-primary">
                {actionLabel}
              </button>
            ) : (
              <span className="text-[11px] text-text-secondary">{actionLabel}</span>
            )
          ) : null}
          <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
          <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-text-primary">{value}</div>
          <div className="mt-1.5 text-[11px] text-text-secondary">{detail}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-bg-primary/60" style={{ color: accent }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/50 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function ProjectCreateModal({
  form,
  saving,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  form: { name: string; description: string; color: string; icon: string; isDefault: boolean };
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (form: { name: string; description: string; color: string; icon: string; isDefault: boolean }) => void;
  onSubmit: () => void;
}) {
  const [activePicker, setActivePicker] = useState<'color' | 'icon' | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const iconPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (colorPickerRef.current?.contains(target)) return;
      if (iconPickerRef.current?.contains(target)) return;
      setActivePicker(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePicker(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectedColor = PROJECT_COLOR_OPTIONS.find((option) => option.value === form.color) ?? PROJECT_COLOR_OPTIONS[0];
  const selectedColorHex = selectedColor.value.toUpperCase();
  const selectedIcon = PROJECT_ICON_OPTIONS.find((option) => option.key === form.icon) ?? PROJECT_ICON_OPTIONS[0];
  const SelectedIcon = selectedIcon.Icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[960px] rounded-[22px] border border-border bg-bg-card shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Create project</div>
            <h3 className="mt-1 text-[16px] font-semibold text-text-primary">New project</h3>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-input p-1.5 text-text-secondary hover:text-text-primary">
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3.5">
            <label className="block">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">Name</div>
              <input
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-border bg-bg-primary/60 px-3.5 py-2.5 text-[12px] text-text-primary outline-none focus:border-accent/50"
                placeholder="Name your new project"
              />
            </label>
            <label className="block">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                className="min-h-[104px] w-full rounded-xl border border-border bg-bg-primary/60 px-3.5 py-2.5 text-[12px] text-text-primary outline-none focus:border-accent/50"
                placeholder="Shared workstream for notes, research, and routing."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative" ref={colorPickerRef}>
                <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">Accent color</div>
                <button
                  type="button"
                  onClick={() => setActivePicker((current) => (current === 'color' ? null : 'color'))}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-primary/60 px-3.5 py-2.5 text-left text-[12px] text-text-primary outline-none transition-colors hover:border-accent/30"
                  aria-haspopup="listbox"
                  aria-expanded={activePicker === 'color'}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                    style={{ backgroundColor: selectedColor.value }}
                  />
                  <span className="flex-1">{selectedColor.label}</span>
                  <span className="hidden text-[11px] text-text-muted sm:inline">{selectedColorHex}</span>
                  <ChevronDown size={14} className="text-text-muted" />
                </button>
                {activePicker === 'color' && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[640px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-bg-card p-4 shadow-2xl shadow-black/30">
                    <div className="mb-1 text-[14px] font-semibold text-text-primary">Choose accent color</div>
                    <div className="mb-3 max-w-xl text-[12px] leading-relaxed text-text-secondary">
                      Select the accent used for buttons, highlights, and active states.
                    </div>
                    <div className="grid grid-cols-5 gap-x-2.5 gap-y-3">
                      {PROJECT_COLOR_OPTIONS.map((option) => {
                        const isSelected = option.value === form.color;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-label={option.label}
                            title={option.label}
                            onClick={() => {
                              onChange({ ...form, color: option.value });
                              setActivePicker(null);
                            }}
                            className={`group flex flex-col items-center gap-2 rounded-2xl border px-2 py-2 transition-all ${
                              isSelected
                                ? 'border-accent/40 bg-bg-primary/80 text-text-primary shadow-[inset_0_0_0_1px_rgba(77,200,232,0.12)]'
                                : 'border-border bg-bg-primary/60 hover:border-accent/30 hover:bg-bg-primary'
                            }`}
                          >
                            <span
                              className={`relative flex h-12 w-12 items-center justify-center rounded-full border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-transform group-hover:scale-105 ${
                                isSelected ? 'ring-4 ring-accent/20 ring-offset-2 ring-offset-bg-card' : ''
                              }`}
                              style={{ backgroundColor: option.value }}
                            >
                              {isSelected && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-bg-primary shadow-lg shadow-black/30">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              )}
                            </span>
                            <span className={`text-[11px] font-medium leading-none ${isSelected ? 'text-accent' : 'text-text-secondary'}`}>
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={iconPickerRef}>
                <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">Icon label</div>
                <button
                  type="button"
                  onClick={() => setActivePicker((current) => (current === 'icon' ? null : 'icon'))}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-primary/60 px-3.5 py-2.5 text-left text-[12px] text-text-primary outline-none transition-colors hover:border-accent/30"
                  aria-haspopup="listbox"
                  aria-expanded={activePicker === 'icon'}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-accent/10 text-accent">
                    <SelectedIcon size={15} />
                  </span>
                  <span className="flex-1">{selectedIcon.label}</span>
                </button>
                {activePicker === 'icon' && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[640px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-bg-card p-4 shadow-2xl shadow-black/30">
                    <div className="mb-1 text-[14px] font-semibold text-text-primary">Choose icon</div>
                    <div className="mb-3 max-w-xl text-[12px] leading-relaxed text-text-secondary">
                      Pick the icon that best represents the workspace.
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {PROJECT_ICON_OPTIONS.map((option) => {
                        const Icon = option.Icon;
                        const isSelected = option.key === form.icon;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            aria-label={option.label}
                            title={option.label}
                            onClick={() => {
                              onChange({ ...form, icon: option.key });
                              setActivePicker(null);
                            }}
                            className={`flex h-[68px] items-center justify-center rounded-2xl border transition-all ${
                              isSelected
                                ? 'border-accent/50 bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(77,200,232,0.12)]'
                                : 'border-border bg-bg-primary/60 text-text-muted hover:border-accent/30 hover:bg-bg-primary hover:text-text-secondary'
                            }`}
                          >
                            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${isSelected ? 'bg-accent/15 text-accent' : 'bg-bg-card text-text-muted'}`}>
                              <Icon size={17} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border bg-bg-primary/60 px-3.5 py-2.5">
              <div>
                <div className="text-[12px] font-medium text-text-primary">Default project</div>
                <div className="text-[10px] text-text-muted">Incoming unassigned notes can fall back here.</div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...form, isDefault: !form.isDefault })}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.isDefault ? 'bg-accent' : 'bg-bg-input border border-border'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.isDefault ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          <div className="space-y-3.5">
            <div className="rounded-2xl border border-border bg-bg-primary/50 p-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preview</div>
              <div className="mt-2.5 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border" style={{ backgroundColor: `${form.color}1f` }}>
                  <SelectedIcon size={17} style={{ color: form.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-text-primary">{form.name.trim() || 'Untitled project'}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                    {form.description.trim() || 'Shared workstream for notes, research, and routing.'}
                  </div>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-border bg-bg-card px-2 py-0.75 text-[10px] text-text-secondary">notes</span>
                <span className="rounded-full border border-border bg-bg-card px-2 py-0.75 text-[10px] text-text-secondary">research</span>
                <span className="rounded-full border border-border bg-bg-card px-2 py-0.75 text-[10px] text-text-secondary">youtube</span>
                {form.isDefault && <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.75 text-[10px] text-accent">default</span>}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] text-red-300">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-bg-primary/50 p-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Note</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
                You can still route Telegram and voice notes into this project later using transcript matching or explicit mentions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-border bg-bg-input px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-bg-card-hover hover:text-text-primary">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !form.name.trim()}
            className="rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
