import {
  X,
  ArrowRight,
  Bot,
  CheckCircle2,
  Filter,
  FolderKanban,
  Image,
  Inbox,
  Mic,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  TimerReset,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createNote, getNoteDetail, getNotes, type NoteDetailResponse, type NoteResponse } from '../../api/notes';
import { getProjects, type ProjectResponse } from '../../api/projects';

type NoteStatus = 'draft' | 'processing' | 'ready' | 'failed' | 'archived' | 'deleted' | 'inbox';
type NoteSource = 'telegram' | 'voice' | 'web' | 'image' | 'manual';

function normalizeNoteStatus(status: string, projectId: string | null): NoteStatus {
  if (!projectId && status.toLowerCase() !== 'deleted') {
    return 'inbox';
  }

  switch (status.toLowerCase()) {
    case 'draft':
      return 'draft';
    case 'processing':
      return 'processing';
    case 'ready':
      return 'ready';
    case 'failed':
      return 'failed';
    case 'archived':
      return 'archived';
    case 'deleted':
      return 'deleted';
    default:
      return projectId ? 'draft' : 'inbox';
  }
}

function normalizeSource(channel: string): NoteSource {
  switch (channel.toLowerCase()) {
    case 'telegram':
      return 'telegram';
    case 'voice':
    case 'api':
      return 'voice';
    case 'image':
      return 'image';
    case 'manual':
    case 'web':
    default:
      return channel.toLowerCase() === 'web' ? 'web' : 'manual';
  }
}

function statusMeta(status: NoteStatus): { label: string; className: string } {
  switch (status) {
    case 'ready':
      return { label: 'Ready', className: 'bg-accent/15 text-accent border-accent/20' };
    case 'processing':
      return { label: 'Processing', className: 'bg-sky-500/15 text-sky-300 border-sky-500/20' };
    case 'draft':
      return { label: 'Draft', className: 'bg-amber-500/15 text-amber-300 border-amber-500/20' };
    case 'failed':
      return { label: 'Failed', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' };
    case 'archived':
      return { label: 'Archived', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' };
    case 'deleted':
      return { label: 'Deleted', className: 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20' };
    case 'inbox':
    default:
      return { label: 'Inbox', className: 'bg-slate-500/15 text-slate-300 border-slate-500/20' };
  }
}

const SOURCE_META: Record<NoteSource, { label: string; icon: ReactNode; color: string }> = {
  telegram: { label: 'Telegram', icon: <Bot size={14} />, color: '#38bdf8' },
  voice: { label: 'Voice', icon: <Mic size={14} />, color: '#00d4aa' },
  web: { label: 'Web', icon: <Sparkles size={14} />, color: '#a78bfa' },
  image: { label: 'Image', icon: <Image size={14} />, color: '#f59e0b' },
  manual: { label: 'Manual', icon: <StickyNote size={14} />, color: '#94a3b8' },
};

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (absMinutes < 1) return 'just now';
  if (absMinutes < 60) return `${absMinutes}m ago`;
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return `${absHours}h ago`;
  const absDays = Math.round(absHours / 24);
  return `${absDays}d ago`;
}

type NoteCardModel = NoteResponse & {
  source: NoteSource;
  statusLabel: string;
  statusClassName: string;
  projectColor: string;
  preview: string;
  updatedLabel: string;
};

type NoteDetailModel = NoteDetailResponse & {
  note: NoteResponse;
};

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | NoteStatus>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetailModel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    projectId: 'inbox',
    sourceChannel: 'web',
    inputKind: 'text',
    primaryLanguage: '',
    summary: '',
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getNotes({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
      getProjects(getCurrentUserId()),
    ])
      .then(([noteList, projectList]) => {
        if (!mounted) return;
        setNotes(noteList);
        setProjects(projectList);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load notes');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedNoteId) {
      setSelectedNote(null);
      return;
    }

    let mounted = true;
    setDetailLoading(true);
    setDetailError(null);

    getNoteDetail(selectedNoteId)
      .then((detail) => {
        if (!mounted) return;
        setSelectedNote(detail);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setDetailError(err instanceof Error ? err.message : 'Failed to load note details');
      })
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedNoteId]);

  const refreshNotes = async (nextSelectedId?: string) => {
    const [noteList, projectList] = await Promise.all([
      getNotes({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
      getProjects(getCurrentUserId()),
    ]);
    setNotes(noteList);
    setProjects(projectList);
    if (nextSelectedId) {
      setSelectedNoteId(nextSelectedId);
    }
  };

  const handleCreateNote = async () => {
    if (!createForm.title.trim() || createSaving) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      const created = await createNote({
        requestedByUserId: getCurrentUserId(),
        projectId: createForm.projectId === 'inbox' ? null : createForm.projectId,
        title: createForm.title.trim(),
        sourceChannel: createForm.sourceChannel,
        inputKind: createForm.inputKind,
        primaryLanguage: createForm.primaryLanguage.trim() || null,
        summary: createForm.summary.trim() || null,
      });
      setCreateOpen(false);
      setCreateForm({
        title: '',
        projectId: 'inbox',
        sourceChannel: 'web',
        inputKind: 'text',
        primaryLanguage: '',
        summary: '',
      });
      await refreshNotes(created.note.id);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setCreateSaving(false);
    }
  };

  const projectColorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.id, project.color ?? '#00d4aa');
    }
    return map;
  }, [projects]);

  const models = useMemo<NoteCardModel[]>(() => {
    return [...notes]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((note) => {
        const source = normalizeSource(note.sourceChannel);
        const status = normalizeNoteStatus(note.status, note.projectId);
        return {
          ...note,
          source,
          statusLabel: statusMeta(status).label,
          statusClassName: statusMeta(status).className,
          projectColor: note.projectId ? (projectColorById.get(note.projectId) ?? '#94a3b8') : '#94a3b8',
          preview: note.summary ?? note.title,
          updatedLabel: formatRelative(note.updatedAt),
        };
      });
  }, [notes, projectColorById]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((note) => {
      const matchesStatus = statusFilter === 'all' || normalizeNoteStatus(note.status, note.projectId) === statusFilter;
      const matchesProject =
        projectFilter === 'all' ||
        (projectFilter === 'inbox' && !note.projectId) ||
        note.projectId === projectFilter;
      const matchesSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.preview.toLowerCase().includes(query) ||
        note.projectName?.toLowerCase().includes(query) ||
        note.sourceChannel.toLowerCase().includes(query) ||
        note.inputKind.toLowerCase().includes(query);
      return matchesStatus && matchesProject && matchesSearch;
    });
  }, [models, projectFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const inboxCount = notes.filter((note) => !note.projectId).length;
    const processingCount = notes.filter((note) => normalizeNoteStatus(note.status, note.projectId) === 'processing').length;
    const readyCount = notes.filter((note) => normalizeNoteStatus(note.status, note.projectId) === 'ready').length;
    return [
      { label: 'Total notes', value: notes.length.toString(), detail: 'Across all projects' },
      { label: 'Inbox items', value: inboxCount.toString(), detail: 'Need routing or review' },
      { label: 'Processing', value: processingCount.toString(), detail: 'Whisper or OCR running' },
      { label: 'Ready to read', value: readyCount.toString(), detail: 'Polished and searchable' },
    ];
  }, [notes]);

  const projectOptions = useMemo(() => {
    return [
      { id: 'all', label: 'All notes' },
      { id: 'inbox', label: 'Inbox' },
      ...projects.map((project) => ({ id: project.id, label: project.name })),
    ];
  }, [projects]);

  const projectSummary = useMemo(() => {
    const sorted = [...models].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return {
      latest: sorted[0],
      routing: [
        { label: 'Explicit project mention', value: 'Project wins immediately' },
        { label: 'Transcript match', value: 'Route when confidence is high' },
        { label: 'Low confidence', value: 'Keep in Inbox' },
      ],
    };
  }, [models]);

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="mx-auto max-w-[1360px] px-6 py-6 animate-pulse">
          <div className="h-[180px] rounded-[28px] border border-border bg-bg-card" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-[110px] rounded-2xl border border-border bg-bg-card" />)}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
            <div className="h-[700px] rounded-[24px] border border-border bg-bg-card" />
            <div className="space-y-5">
              <div className="h-[230px] rounded-2xl border border-border bg-bg-card" />
              <div className="h-[180px] rounded-2xl border border-border bg-bg-card" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[1360px] px-6 py-6">
        <section className="relative overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.12),rgba(19,28,48,0.95)_55%,rgba(12,18,33,1))] p-6">
          <div className="absolute right-0 top-0 h-60 w-60 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent/12 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent">
                <StickyNote size={13} />
                Notes inbox
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-tight text-text-primary">
                Capture anything, route it to a project, and keep the original intact.
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                Notes can arrive from the page, Telegram, voice, images, or simple manual input.
                We keep the raw input, the transcript, and the polished note so the user can trace
                how the final version was produced.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
              >
                <Plus size={16} />
                New note
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                <FolderKanban size={16} className="text-accent" />
                Assign project
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-bg-card p-4">
              <div className="text-[12px] text-text-muted">{stat.label}</div>
              <div className="mt-2 text-[26px] font-semibold tracking-tight text-text-primary">{stat.value}</div>
              <div className="mt-1 text-[12px] text-text-secondary">{stat.detail}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
          <div className="rounded-[24px] border border-border bg-bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-text-primary">Recent notes</h2>
                <p className="mt-1 text-[13px] text-text-secondary">
                  Search and filter by status, then open a note to inspect its source trail.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:min-w-[420px] lg:items-end">
                <div className="relative w-full">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search notes, projects, or tags…"
                    className="w-full rounded-xl border border-border bg-bg-primary/65 py-2.5 pl-9 pr-4 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Filter size={14} className="text-text-muted" />
                  {(['all', 'inbox', 'processing', 'draft', 'ready', 'failed'] as const).map((item) => {
                    const active = statusFilter === item;
                    return (
                      <button
                        key={item}
                        onClick={() => setStatusFilter(item)}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                          active
                            ? 'border-accent/30 bg-accent/15 text-accent'
                            : 'border-border bg-bg-primary/45 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                        }`}
                      >
                        {item === 'all' ? 'All notes' : item}
                      </button>
                    );
                  })}
                </div>

                <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Project</span>
                  {projectOptions.map((project) => {
                    const active = projectFilter === project.id;
                    return (
                      <button
                        key={project.id}
                        onClick={() => setProjectFilter(project.id)}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          active
                            ? 'border-accent/30 bg-accent/15 text-accent'
                            : 'border-border bg-bg-primary/45 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                        }`}
                      >
                        {project.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {filteredNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-input text-text-muted">
                    <Inbox size={20} />
                  </div>
                  <div className="mt-4 text-[15px] font-semibold text-text-primary">No notes match this filter</div>
                  <p className="mt-2 text-[13px] text-text-secondary">
                    Try a different status, project, or search term.
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div key={note.id} onClick={() => setSelectedNoteId(note.id)} className="cursor-pointer">
                    <NoteRow note={note} />
                  </div>
                ))
              )}
            </div>
          </div>

          <aside className="space-y-5">
            {selectedNoteId ? (
              <NoteDetailPanel
                detail={selectedNote}
                loading={detailLoading}
                error={detailError}
                onClose={() => setSelectedNoteId(null)}
              />
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(0,212,170,0.12),rgba(19,28,48,0.92))] p-5">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
                    <TimerReset size={13} />
                    Capture flow
                  </div>
                  <h3 className="mt-3 text-[18px] font-semibold text-text-primary">What happens when a note arrives</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      'Store the raw payload and original file.',
                      'Transcribe voice with Whisper or read text as-is.',
                      'Let the model polish the note while preserving the original.',
                      'Route to a project or fall back to Inbox if confidence is low.',
                    ].map((step, index) => (
                      <div key={step} className="flex gap-3 rounded-xl border border-border bg-bg-primary/55 p-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                          {index + 1}
                        </div>
                        <div className="text-[13px] leading-relaxed text-text-secondary">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[16px] font-semibold text-text-primary">Routing preview</h3>
                      <p className="mt-1 text-[13px] text-text-secondary">How the sidebar should feel to the user.</p>
                    </div>
                    <div className="rounded-xl bg-bg-input px-3 py-2 text-[12px] font-medium text-text-secondary">
                      Inbox first
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {projectSummary.routing.map((item) => (
                      <div key={item.label} className="rounded-xl border border-border bg-bg-primary/50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
                        <div className="mt-1 text-[13px] text-text-primary">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-bg-primary/50 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Latest note</div>
                    <div className="mt-1 text-[13px] text-text-primary">
                      {projectSummary.latest ? projectSummary.latest.preview : 'No notes yet.'}
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>
      {createOpen && (
        <NoteCreateModal
          form={createForm}
          projects={projects}
          saving={createSaving}
          error={createError}
          onClose={() => setCreateOpen(false)}
          onChange={setCreateForm}
          onSubmit={handleCreateNote}
        />
      )}
    </main>
  );
}

function NoteRow({ note }: { note: NoteCardModel }) {
  const source = SOURCE_META[note.source];

  return (
    <article className="rounded-2xl border border-border bg-bg-primary/55 p-4 transition-colors hover:border-accent/25 hover:bg-bg-card-hover">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
              style={{ color: source.color, borderColor: `${source.color}40`, background: `${source.color}12` }}
            >
              {source.icon}
              {source.label}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${note.statusClassName}`}>
              {note.statusLabel}
            </span>
            <span className="text-[11px] text-text-muted">Updated {note.updatedLabel}</span>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-input text-accent">
              <StickyNote size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-text-primary">{note.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{note.preview}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {note.summary && (
              <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                Summary exists
              </span>
            )}
            <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
              {note.sourceChannel}
            </span>
            <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
              {note.inputKind}
            </span>
          </div>
        </div>

        <div className="flex min-w-[270px] flex-col gap-3 rounded-2xl border border-border bg-bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Project</div>
              <div className="mt-1 text-[14px] font-semibold text-text-primary">
                {note.projectName ?? 'Inbox'}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-input">
              <FolderKanban size={16} style={{ color: note.projectColor }} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-primary/55 p-3">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Source</span>
              <span className="inline-flex items-center gap-1">
                <Paperclip size={12} />
                {note.currentTextVersionId ? 'Polished' : 'Raw'}
              </span>
            </div>
            <div className="mt-2 text-[13px] text-text-primary">
              Created {formatRelative(note.createdAt)}
            </div>
          </div>

          <button className="inline-flex items-center justify-between rounded-xl border border-border bg-bg-primary/55 px-3 py-2.5 text-left text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={14} className="text-accent" />
              Open note
            </span>
            <ArrowRight size={14} />
          </button>

          <div className="rounded-xl border border-border bg-bg-primary/55 p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-muted">
              <Tag size={12} />
              Routing
            </div>
            <div className="mt-2 text-[13px] text-text-primary">
              {note.projectId ? 'Linked to a project' : 'Inbox fallback'}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function NoteCreateModal({
  form,
  projects,
  saving,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  form: {
    title: string;
    projectId: string;
    sourceChannel: string;
    inputKind: string;
    primaryLanguage: string;
    summary: string;
  };
  projects: ProjectResponse[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (form: {
    title: string;
    projectId: string;
    sourceChannel: string;
    inputKind: string;
    primaryLanguage: string;
    summary: string;
  }) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[24px] border border-border bg-bg-card shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Create note</div>
            <h3 className="mt-1 text-[18px] font-semibold text-text-primary">New note</h3>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-input p-2 text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Title</div>
              <input
                value={form.title}
                onChange={(e) => onChange({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                placeholder="Telegram: launch checklist"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Source channel</div>
                <select
                  value={form.sourceChannel}
                  onChange={(e) => onChange({ ...form, sourceChannel: e.target.value })}
                  className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                >
                  <option value="web">Web</option>
                  <option value="telegram">Telegram</option>
                  <option value="voice">Voice</option>
                  <option value="image">Image</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Input kind</div>
                <select
                  value={form.inputKind}
                  onChange={(e) => onChange({ ...form, inputKind: e.target.value })}
                  className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                >
                  <option value="text">Text</option>
                  <option value="audio">Audio</option>
                  <option value="image">Image</option>
                  <option value="file">File</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Primary language</div>
                <input
                  value={form.primaryLanguage}
                  onChange={(e) => onChange({ ...form, primaryLanguage: e.target.value })}
                  className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                  placeholder="en"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Project</div>
                <select
                  value={form.projectId}
                  onChange={(e) => onChange({ ...form, projectId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                >
                  <option value="inbox">Inbox</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Summary</div>
              <textarea
                value={form.summary}
                onChange={(e) => onChange({ ...form, summary: e.target.value })}
                className="min-h-[140px] w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                placeholder="Optional polished summary or note body."
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-primary/50 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Preview</div>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-accent/10 text-accent">
                  <StickyNote size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-text-primary">{form.title.trim() || 'Untitled note'}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                    {form.summary.trim() || 'The raw note will be stored, and the polished version can be generated later.'}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{form.sourceChannel}</span>
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{form.inputKind}</span>
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{form.projectId === 'inbox' ? 'Inbox' : 'Project'}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-red-300">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-bg-primary/50 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Note</div>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                You can attach audio, image, or Telegram ingestion later. This create flow stores the core note first so routing can happen immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-border bg-bg-input px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-bg-card-hover hover:text-text-primary">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !form.title.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteDetailPanel({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: NoteDetailModel | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <div className="h-6 w-36 animate-pulse rounded bg-bg-input" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-bg-input" />
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-input" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-[13px] text-red-300">
        {error}
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { note, inputs, assets, textVersions, processingRuns } = detail;

  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Note detail</div>
          <h3 className="mt-2 text-[20px] font-semibold text-text-primary">{note.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{note.summary ?? 'No summary yet.'}</p>
        </div>
        <button onClick={onClose} className="rounded-lg border border-border bg-bg-input p-2 text-text-secondary hover:text-text-primary">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <InfoPill label="Project" value={note.projectName ?? 'Inbox'} />
        <InfoPill label="Inputs" value={String(inputs.length)} />
        <InfoPill label="Versions" value={String(textVersions.length)} />
      </div>

      {textVersions.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-bg-primary/55 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Latest polished note</div>
          <div className="mt-2 text-[13px] leading-relaxed text-text-primary">
            {textVersions[textVersions.length - 1]?.text}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <SectionBlock title="Inputs">
          {inputs.length === 0 ? (
            <EmptyBlock label="No inputs yet." />
          ) : (
            inputs.map((input) => (
              <MiniCard key={input.id} title={`${input.sourceChannel} · ${input.inputKind}`} sub={`${input.status} · ${formatRelative(input.receivedAt)}`} body={input.rawText ?? 'No raw text captured.'} />
            ))
          )}
        </SectionBlock>

        <SectionBlock title="Assets">
          {assets.length === 0 ? (
            <EmptyBlock label="No assets attached." />
          ) : (
            assets.map((asset) => (
              <MiniCard key={asset.id} title={asset.assetType} sub={`${asset.mimeType} · ${asset.storageKey}`} body={asset.originalFilename ?? 'Stored asset'} />
            ))
          )}
        </SectionBlock>

        <SectionBlock title="Text versions">
          {textVersions.length === 0 ? (
            <EmptyBlock label="No text versions yet." />
          ) : (
            textVersions.map((version) => (
              <MiniCard key={version.id} title={version.versionKind} sub={`${version.provider ?? 'local'} · ${version.model ?? '—'}`} body={version.text} />
            ))
          )}
        </SectionBlock>

        <SectionBlock title="Processing runs">
          {processingRuns.length === 0 ? (
            <EmptyBlock label="No processing runs yet." />
          ) : (
            processingRuns.map((run) => (
              <MiniCard key={run.id} title={`${run.stage} · ${run.status}`} sub={`${run.provider ?? 'local'} · ${run.model ?? '—'}`} body={run.errorMessage ?? run.inputHash ?? 'Queued or completed processing'} />
            ))
          )}
        </SectionBlock>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/50 px-3 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-text-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MiniCard({ title, sub, body }: { title: string; sub: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/55 p-3">
      <div className="text-[13px] font-medium text-text-primary">{title}</div>
      <div className="mt-1 text-[11px] text-text-muted">{sub}</div>
      <div className="mt-2 text-[12px] leading-relaxed text-text-secondary">{body}</div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-border px-4 py-6 text-[13px] text-text-muted">{label}</div>;
}
