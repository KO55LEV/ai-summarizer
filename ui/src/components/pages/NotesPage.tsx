import {
  X,
  ArrowRight,
  Bot,
  Filter,
  FolderKanban,
  FileText,
  Image,
  Inbox,
  Mic,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  TimerReset,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createNote, getNoteDetail, getNotes, uploadNoteAsset, type NoteDetailResponse, type NoteResponse } from '../../api/notes';
import { getProjects, type ProjectResponse } from '../../api/projects';

type NoteStatus = 'draft' | 'processing' | 'ready' | 'failed' | 'archived' | 'deleted' | 'inbox';
type NoteSource = 'telegram' | 'voice' | 'web' | 'image' | 'manual';
type NoteInputKind = 'text' | 'audio' | 'image' | 'file' | 'mixed';

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

function sourceAccent(source: NoteSource): string {
  return SOURCE_META[source].color;
}

function inputKindLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'audio':
      return 'Audio';
    case 'image':
      return 'Image';
    case 'file':
      return 'File';
    case 'mixed':
      return 'Mixed';
    default:
      return 'Text';
  }
}

function inferInputKindFromFiles(files: File[]): NoteInputKind {
  if (files.length === 0) {
    return 'text';
  }

  const kinds = new Set(files.map((file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf') return 'file';
    return 'mixed';
  }));

  return kinds.size === 1 ? (kinds.values().next().value as NoteInputKind) : 'mixed';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib < 10 ? 1 : 0)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib < 10 ? 1 : 0)} MB`;
}

function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) {
    return '—';
  }

  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib < 10 ? 1 : 0)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib < 10 ? 1 : 0)} MB`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function assetLabel(assetType: string, mimeType: string): string {
  if (assetType) {
    return assetType.replace(/_/g, ' ');
  }

  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'file';
}

function assetIcon(assetType: string, mimeType: string): ReactNode {
  const kind = assetLabel(assetType, mimeType).toLowerCase();
  if (kind.includes('audio')) return <Mic size={14} />;
  if (kind.includes('image')) return <Image size={14} />;
  return <FileText size={14} />;
}

function processingStatusMeta(status: string): { label: string; className: string } {
  switch (status.toLowerCase()) {
    case 'succeeded':
      return { label: 'Succeeded', className: 'bg-accent/15 text-accent border-accent/20' };
    case 'running':
      return { label: 'Running', className: 'bg-sky-500/15 text-sky-300 border-sky-500/20' };
    case 'retrying':
      return { label: 'Retrying', className: 'bg-amber-500/15 text-amber-300 border-amber-500/20' };
    case 'failed':
      return { label: 'Failed', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' };
    case 'dead_letter':
      return { label: 'Dead letter', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' };
    default:
      return { label: status, className: 'bg-bg-input text-text-secondary border-border' };
  }
}

function versionKindLabel(versionKind: string): string {
  switch (versionKind.toLowerCase()) {
    case 'transcript':
      return 'Transcript';
    case 'polished':
      return 'Polished';
    case 'summary':
      return 'Summary';
    case 'original':
      return 'Original';
    default:
      return versionKind;
  }
}

function summarizeRecord(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) {
    return null;
  }

  const preferredKeys = ['message', 'transcriptText', 'summary', 'text', 'detail', 'error'];
  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  const entries = Object.entries(record).filter(([, value]) => value != null);
  if (entries.length === 0) {
    return null;
  }

  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : String(value)}`)
    .join(' · ');
}

function noteTitleLabel(title: string | null | undefined): string {
  return title?.trim() || 'Untitled note';
}

const NOTE_ATTACHMENT_ACCEPT = 'image/*,audio/*,application/pdf';

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
  const [createDraftNoteId, setCreateDraftNoteId] = useState<string | null>(null);
  const [createAttachments, setCreateAttachments] = useState<File[]>([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    projectId: 'inbox',
    inputKind: 'text' as NoteInputKind,
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

  const refreshNotes = async (nextSelectedId?: string, select = true) => {
    const [noteList, projectList] = await Promise.all([
      getNotes({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
      getProjects(getCurrentUserId()),
    ]);
    setNotes(noteList);
    setProjects(projectList);
    if (select && nextSelectedId) {
      setSelectedNoteId(nextSelectedId);
    }
  };

  const handleCreateNote = async () => {
    if (createSaving) return;
    if (!createForm.title.trim() && !createForm.summary.trim() && createAttachments.length === 0) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      let noteId = createDraftNoteId;
      if (!noteId) {
        const created = await createNote({
          requestedByUserId: getCurrentUserId(),
          projectId: createForm.projectId === 'inbox' ? null : createForm.projectId,
          title: createForm.title.trim() || null,
          sourceChannel: 'web',
          inputKind: createForm.inputKind,
          summary: createForm.summary.trim() || null,
        });
        noteId = created.note.id;
        setCreateDraftNoteId(noteId);
        await refreshNotes(undefined, false);
      }

      if (createAttachments.length > 0) {
        await Promise.all(
          createAttachments.map((file) => uploadNoteAsset(noteId!, file)),
        );
      }

      setCreateOpen(false);
      setCreateDraftNoteId(null);
      setCreateAttachments([]);
      setCreateForm({
        title: '',
        projectId: 'inbox',
        inputKind: 'text',
        summary: '',
      });
      setSelectedNoteId(noteId!);
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
          preview: (note.summary ?? note.title) || 'Untitled note',
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
      <div className="mx-auto max-w-[1360px] px-3 py-3 sm:px-5 sm:py-5">
        <section className="rounded-[22px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.12),rgba(19,28,48,0.96)_45%,rgba(12,18,33,1))] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.2)] sm:p-4.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[22px] font-semibold tracking-tight text-text-primary sm:text-[24px]">Notes</h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
                Capture text, files, images, and voice notes in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setCreateForm({
                    title: '',
                    projectId: 'inbox',
                    inputKind: 'text',
                    summary: '',
                  });
                  setCreateAttachments([]);
                  setCreateDraftNoteId(null);
                  setCreateError(null);
                  setCreateOpen(true);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover sm:w-auto"
              >
                <Plus size={14} />
                New note
              </button>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary sm:w-auto">
                <FolderKanban size={14} className="text-accent" />
                Assign project
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-[24px] border border-border bg-bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-text-primary sm:text-[18px]">Recent notes</h2>
                  <p className="mt-1 text-[12px] text-text-secondary sm:text-[13px]">
                    Search, filter, and open a note to inspect its source trail.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover"
                  >
                    <Plus size={14} />
                    New note
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                  >
                    <Filter size={14} className="text-accent" />
                    Reset filters
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,auto))]">
                <label className="flex items-center gap-2.5 rounded-2xl border border-border bg-bg-primary/65 px-3.5 py-2.5">
                  <Search size={15} className="text-text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search notes, projects, or tags…"
                    className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted"
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | NoteStatus)}
                  className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
                >
                  <option value="all">All notes</option>
                  <option value="inbox">Inbox</option>
                  <option value="processing">Processing</option>
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="failed">Failed</option>
                </select>

                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="rounded-2xl border border-border bg-bg-card px-3.5 py-2.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
                >
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-[18px] border border-border">
                <table className="min-w-full border-collapse">
                  <thead className="bg-bg-primary/40">
                    <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-text-muted">
                      <th className="px-3 py-3.5 font-medium sm:px-4">Note</th>
                      <th className="hidden px-4 py-3.5 font-medium sm:table-cell">Source</th>
                      <th className="hidden px-4 py-3.5 font-medium md:table-cell">Project</th>
                      <th className="hidden px-4 py-3.5 font-medium lg:table-cell">Updated</th>
                      <th className="hidden px-4 py-3.5 font-medium lg:table-cell">Status</th>
                      <th className="px-3 py-3.5 text-right font-medium sm:px-4">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredNotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-input text-text-muted">
                            <Inbox size={20} />
                          </div>
                          <div className="mt-4 text-[15px] font-semibold text-text-primary">No notes match this filter</div>
                          <p className="mt-2 text-[13px] text-text-secondary">
                            Try a different status, project, or search term.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredNotes.map((note) => (
                        <NoteTableRow key={note.id} note={note} onOpen={() => setSelectedNoteId(note.id)} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
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
          attachments={createAttachments}
          draftNoteCreated={Boolean(createDraftNoteId)}
          saving={createSaving}
          error={createError}
          onClose={() => {
            setCreateOpen(false);
            setCreateDraftNoteId(null);
            setCreateAttachments([]);
            setCreateError(null);
          }}
          onChange={setCreateForm}
          onAttachmentsChange={(files) => {
            setCreateAttachments(files);
            setCreateForm((current) => ({ ...current, inputKind: inferInputKindFromFiles(files) }));
          }}
          onSubmit={handleCreateNote}
        />
      )}
    </main>
  );
}

function NoteTableRow({ note, onOpen }: { note: NoteCardModel; onOpen: () => void }) {
  const source = SOURCE_META[note.source];

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`Open note ${noteTitleLabel(note.title)}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer transition-colors hover:bg-bg-card-hover/50"
    >
      <td className="px-3 py-4 align-top sm:px-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border"
            style={{ color: sourceAccent(note.source), background: `${sourceAccent(note.source)}12` }}
          >
            <StickyNote size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium"
                style={{ color: source.color, borderColor: `${source.color}40`, background: `${source.color}12` }}
              >
                {source.icon}
                {source.label}
              </span>
              <span className="text-[11px] text-text-muted">Updated {note.updatedLabel}</span>
            </div>
            <div className="mt-2 truncate text-[14px] font-semibold text-text-primary">{noteTitleLabel(note.title)}</div>
            <div className="mt-1 max-w-[460px] text-[12px] leading-relaxed text-text-secondary">{note.preview}</div>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-4 align-top sm:table-cell">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${note.statusClassName}`}>{note.statusLabel}</span>
      </td>
      <td className="hidden px-4 py-4 align-top md:table-cell">
        <div className="inline-flex items-center gap-2">
          <FolderKanban size={14} style={{ color: note.projectColor }} />
          <span className="text-[12px] text-text-secondary">{note.projectName ?? 'Inbox'}</span>
        </div>
      </td>
      <td className="hidden px-4 py-4 align-top lg:table-cell text-[12px] text-text-secondary">{formatRelative(note.createdAt)}</td>
      <td className="hidden px-4 py-4 align-top lg:table-cell">
        <span className="rounded-full border border-border bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary">
          {note.projectId ? 'Linked' : 'Inbox'}
        </span>
      </td>
      <td className="px-3 py-4 align-top text-right sm:px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
          Open
          <ArrowRight size={13} />
        </span>
      </td>
    </tr>
  );
}

function NoteCreateModal({
  form,
  projects,
  attachments,
  draftNoteCreated,
  saving,
  error,
  onClose,
  onChange,
  onAttachmentsChange,
  onSubmit,
}: {
  form: {
    title: string;
    projectId: string;
    inputKind: NoteInputKind;
    summary: string;
  };
  projects: ProjectResponse[];
  attachments: File[];
  draftNoteCreated: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (form: {
    title: string;
    projectId: string;
    inputKind: NoteInputKind;
    summary: string;
  }) => void;
  onAttachmentsChange: (files: File[]) => void;
  onSubmit: () => void;
}) {
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentAccept, setAttachmentAccept] = useState(NOTE_ATTACHMENT_ACCEPT);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'unsupported'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingDeviceLabel, setRecordingDeviceLabel] = useState<string | null>(null);
  const attachmentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (attachmentRef.current?.contains(target)) return;
      setAttachmentOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAttachmentOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingState('unsupported');
      return;
    }

    setRecordingState((current) => (current === 'unsupported' ? 'idle' : current));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, []);

  const openFilePicker = (accept: string) => {
    setAttachmentOpen(false);
    setAttachmentAccept(accept);
    window.setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    }, 0);
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextAttachments = [...attachments, ...Array.from(files)];
    onAttachmentsChange(nextAttachments);
    onChange({ ...form, inputKind: inferInputKindFromFiles(nextAttachments) });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  };

  const startRecording = async () => {
    if (recordingState === 'recording' || recordingState === 'unsupported') {
      return;
    }

    setRecordingError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream);
      const preferredMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((mimeType) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(mimeType),
      );

      recordedChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecordingDeviceLabel(stream.getAudioTracks()[0]?.label ?? null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (!isMountedRef.current) {
          return;
        }

        const startedAt = recordingStartedAtRef.current ?? Date.now();
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const mimeType = recorder.mimeType || preferredMimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });

        if (blob.size > 0) {
          const extension =
            mimeType.includes('mp4') ? 'm4a' :
            mimeType.includes('ogg') ? 'ogg' :
            'webm';
          const file = new File(
            [blob],
            `voice-note-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            { type: mimeType },
          );
          const nextAttachments = [...attachments, file];
          onAttachmentsChange(nextAttachments);
          onChange({ ...form, inputKind: inferInputKindFromFiles(nextAttachments) });
        } else {
          setRecordingError('Recording was empty. Try again.');
        }

        recordedChunksRef.current = [];
        recordingStartedAtRef.current = null;
        setRecordingSeconds(durationSeconds);
        setRecordingState('idle');

        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      recorder.start();
      setRecordingState('recording');
      recordingTimerRef.current = window.setInterval(() => {
        const startedAt = recordingStartedAtRef.current ?? Date.now();
        setRecordingSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      }, 250);
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return;
      }

      setRecordingState('idle');
      setRecordingError(err instanceof Error ? err.message : 'Microphone access failed.');
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
  };

  const toggleRecording = async () => {
    if (recordingState === 'recording') {
      await stopRecording();
      return;
    }

    await startRecording();
  };

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
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">Title (optional)</div>
              <input
                value={form.title}
                onChange={(e) => onChange({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent/50"
                placeholder="Optional title"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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

            <div className="block">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                <span>Message</span>
                <span className="rounded-full border border-border bg-bg-primary/70 px-2 py-1 text-[10px] text-text-secondary">
                  {attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}` : 'Text only'}
                </span>
              </div>
              <div
                ref={attachmentRef}
                className="relative rounded-2xl border border-border bg-bg-primary/60 p-3.5 transition-colors focus-within:border-accent/50"
              >
                <textarea
                  value={form.summary}
                  onChange={(e) => onChange({ ...form, summary: e.target.value })}
                  className="min-h-[170px] w-full resize-none border-0 bg-transparent px-0 py-0 text-[13px] text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="Write a note, paste a link, or add a quick thought..."
                />
                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.map((file, index) => {
                      const kind = file.type.startsWith('image/')
                        ? 'Image'
                        : file.type.startsWith('audio/')
                          ? 'Audio'
                          : file.type === 'application/pdf'
                            ? 'PDF'
                            : 'File';
                      return (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-bg-card px-3 py-2 text-[12px] text-text-secondary"
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                            {kind === 'Image' ? <Image size={14} /> : kind === 'Audio' ? <Mic size={14} /> : <FileText size={14} />}
                          </span>
                          <span className="max-w-[180px] truncate">{file.name}</span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
                            {formatFileSize(file.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onAttachmentsChange(attachments.filter((_, currentIndex) => currentIndex !== index))}
                            className="rounded-full p-1 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAttachmentOpen((current) => !current)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-card text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                        aria-label="Add attachment"
                        aria-haspopup="menu"
                        aria-expanded={attachmentOpen}
                      >
                        <Plus size={16} />
                      </button>
                      {attachmentOpen && (
                        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-56 rounded-2xl border border-border bg-bg-card p-2 shadow-2xl shadow-black/30">
                          {[
                            { label: 'Photo', icon: <Image size={14} />, kind: 'image' as NoteInputKind, accept: 'image/*' },
                            { label: 'Audio file', icon: <Mic size={14} />, kind: 'audio' as NoteInputKind, accept: 'audio/*' },
                            { label: 'Record audio', icon: <Mic size={14} />, kind: 'audio' as NoteInputKind, accept: null },
                            { label: 'PDF', icon: <FileText size={14} />, kind: 'file' as NoteInputKind, accept: 'application/pdf' },
                            { label: 'All files', icon: <Paperclip size={14} />, kind: 'mixed' as NoteInputKind, accept: NOTE_ATTACHMENT_ACCEPT },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => {
                                if (item.accept) {
                                  openFilePicker(item.accept);
                                  return;
                                }

                                setAttachmentOpen(false);
                                void toggleRecording();
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
                                item.label === 'Record audio' && recordingState === 'recording'
                                  ? 'bg-rose-500/10 text-rose-300'
                                  : form.inputKind === item.kind
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-text-secondary hover:bg-bg-primary/60 hover:text-text-primary'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className={item.label === 'Record audio' && recordingState === 'recording' ? 'text-rose-300' : 'text-accent'}>
                                  {item.label === 'Record audio' && recordingState === 'recording' ? <Square size={14} /> : item.icon}
                                </span>
                                {item.label}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
                                {item.label === 'Record audio' ? (recordingState === 'recording' ? 'Stop' : 'Live') : inputKindLabel(item.kind)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={recordingState === 'unsupported'}
                      className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        recordingState === 'recording'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                          : 'border-border bg-bg-card text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                      }`}
                      aria-label={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
                    >
                      {recordingState === 'recording' ? <Square size={15} /> : <Mic size={15} />}
                      {recordingState === 'recording' ? `Recording ${formatRecordingDuration(recordingSeconds)}` : 'Record'}
                    </button>
                  </div>
                  <div className="inline-flex h-10 items-center rounded-xl border border-border bg-bg-card px-3 text-[12px] font-medium text-text-secondary">
                    {inputKindLabel(form.inputKind)}
                  </div>
                </div>
                {recordingError && (
                  <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-red-300">
                    {recordingError}
                  </div>
                )}
                {recordingState === 'recording' && (
                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                    Recording in progress {recordingDeviceLabel ? `from ${recordingDeviceLabel}` : ''}. Stop to attach it to the note.
                  </div>
                )}
                {recordingState === 'unsupported' && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                    This browser does not support microphone recording.
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={attachmentAccept}
                  onChange={(event) => handleFilesSelected(event.target.files)}
                  className="hidden"
                />
              </div>
            </div>
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
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{inputKindLabel(form.inputKind)}</span>
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{form.projectId === 'inbox' ? 'Inbox' : 'Project'}</span>
                <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">{attachments.length} files</span>
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
                Add a note, attach images, PDFs, or audio from the plus button, and route it to a project if needed.
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
            disabled={saving || (!form.title.trim() && !form.summary.trim() && attachments.length === 0)}
            className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? draftNoteCreated && attachments.length > 0
                ? 'Uploading…'
                : 'Creating…'
              : draftNoteCreated && attachments.length > 0
                ? 'Retry upload'
                : 'Create note'}
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
  const source = SOURCE_META[normalizeSource(note.sourceChannel)];
  const currentTextVersion =
    textVersions.find((version) => version.id === note.currentTextVersionId) ??
    textVersions[textVersions.length - 1] ??
    null;
  const bodyText =
    currentTextVersion?.text?.trim() ||
    note.summary?.trim() ||
    'This note does not have extracted text yet.';
  const bodyLabel = currentTextVersion
    ? `${versionKindLabel(currentTextVersion.versionKind)} · ${currentTextVersion.provider ?? 'local'}`
    : note.summary
      ? 'Note summary'
      : 'No extracted text';
  const noteStatus = statusMeta(normalizeNoteStatus(note.status, note.projectId));
  const textStats = [
    { label: 'Created', value: formatDateTime(note.createdAt) },
    { label: 'Updated', value: formatDateTime(note.updatedAt) },
    { label: 'Assets', value: String(assets.length) },
    { label: 'Versions', value: String(textVersions.length) },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-bg-card shadow-2xl shadow-black/30">
      <div className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.16),rgba(19,28,48,0.92)_58%,rgba(12,18,33,1))] p-5">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: `${source.color}18`, color: source.color }}>
                {source.icon}
              </span>
              {source.label}
            </div>
            <h3 className="mt-4 truncate text-[22px] font-semibold tracking-tight text-text-primary">{noteTitleLabel(note.title)}</h3>
            <p className="mt-2 max-w-[34rem] text-[13px] leading-relaxed text-text-secondary">
              {note.summary?.trim() || 'No summary has been added yet. The note body and extracted content will appear here once processing runs complete.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-card/80 p-2 text-text-secondary transition-colors hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${noteStatus.className}`}>
            {noteStatus.label}
          </span>
          <span className="rounded-full border border-border bg-bg-card/80 px-3 py-1 text-[11px] font-medium text-text-secondary">
            {inputKindLabel(note.inputKind)}
          </span>
          <span className="rounded-full border border-border bg-bg-card/80 px-3 py-1 text-[11px] font-medium text-text-secondary">
            {note.projectName ?? 'Inbox'}
          </span>
          {note.primaryLanguage && (
            <span className="rounded-full border border-border bg-bg-card/80 px-3 py-1 text-[11px] font-medium text-text-secondary">
              {note.primaryLanguage.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          {textStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-bg-primary/55 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
              <div className="mt-1.5 text-[13px] font-medium text-text-primary">{item.value}</div>
            </div>
          ))}
        </div>

        <DetailSection title={bodyLabel} subtitle="Canonical note content">
          <div className="rounded-2xl border border-border bg-bg-primary/65 p-4">
            <div className="whitespace-pre-wrap text-[13px] leading-7 text-text-primary">{bodyText}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentTextVersion?.language && (
              <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                Language {currentTextVersion.language.toUpperCase()}
              </span>
            )}
            {currentTextVersion?.provider && (
              <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                {currentTextVersion.provider}
              </span>
            )}
            {currentTextVersion?.createdAt && (
              <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                Updated {formatRelative(currentTextVersion.createdAt)}
              </span>
            )}
          </div>
        </DetailSection>

        <DetailSection title="Source trail" subtitle="What was captured before enrichment">
          {inputs.length === 0 ? (
            <EmptyBlock label="No raw inputs were captured for this note." />
          ) : (
            <div className="space-y-3">
              {inputs.map((input) => (
                <div key={input.id} className="rounded-2xl border border-border bg-bg-primary/55 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                        {input.sourceChannel}
                      </span>
                      <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                        {inputKindLabel(input.inputKind)}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta(normalizeNoteStatus(input.status, note.projectId)).className}`}>
                        {input.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted">{formatRelative(input.receivedAt)}</span>
                  </div>
                  <div className="mt-3 text-[13px] leading-relaxed text-text-secondary">
                    {input.rawText ?? 'No raw text captured.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Attachments" subtitle="Stored files linked to this note">
          {assets.length === 0 ? (
            <EmptyBlock label="No assets attached yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-border bg-bg-primary/55 p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border"
                      style={{ background: `${source.color}12`, color: source.color }}
                    >
                      {assetIcon(asset.assetType, asset.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-text-primary">
                        {asset.originalFilename ?? assetLabel(asset.assetType, asset.mimeType)}
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted">
                        {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {asset.durationSeconds != null && (
                      <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                        {Number(asset.durationSeconds).toFixed(0)}s
                      </span>
                    )}
                    {asset.width != null && asset.height != null && (
                      <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                        {asset.width} x {asset.height}
                      </span>
                    )}
                    <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                      {assetLabel(asset.assetType, asset.mimeType)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Text versions" subtitle="Transcripts, summaries, and polished outputs">
          {textVersions.length === 0 ? (
            <EmptyBlock label="No text versions yet." />
          ) : (
            <div className="space-y-3">
              {textVersions.map((version) => {
                const isCurrent = version.id === note.currentTextVersionId;
                return (
                  <div key={version.id} className={`rounded-2xl border p-4 ${isCurrent ? 'border-accent/30 bg-accent/8' : 'border-border bg-bg-primary/55'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                          {versionKindLabel(version.versionKind)}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted">{formatRelative(version.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap">
                      {version.text}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span>{version.provider ?? 'local'}</span>
                      <span>·</span>
                      <span>{version.model ?? '—'}</span>
                      {version.language && (
                        <>
                          <span>·</span>
                          <span>{version.language.toUpperCase()}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Processing runs" subtitle="Operational trail for the note">
          {processingRuns.length === 0 ? (
            <EmptyBlock label="No processing runs yet." />
          ) : (
            <div className="space-y-3">
              {processingRuns.map((run) => {
                const meta = processingStatusMeta(run.status);
                return (
                  <div key={run.id} className="rounded-2xl border border-border bg-bg-primary/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                          {run.stage}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        {formatRelative(run.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                      {run.errorMessage ?? summarizeRecord(run.output) ?? run.inputHash ?? 'Queued or completed processing'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span>{run.provider ?? 'local'}</span>
                      <span>·</span>
                      <span>{run.model ?? '—'}</span>
                      {run.sourceAssetId && (
                        <>
                          <span>·</span>
                          <span>{run.sourceAssetId}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DetailSection>
      </div>
    </div>
  );
}

function DetailSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{title}</div>
        {subtitle && <div className="mt-1 text-[12px] text-text-secondary">{subtitle}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-[13px] text-text-muted">
      {label}
    </div>
  );
}
