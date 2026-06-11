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
  Link2,
  MessageSquareQuote,
  MoreVertical,
  PencilLine,
  Palette,
  Play,
  Plus,
  CalendarDays,
  Filter,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  UserPlus,
  Circle,
  X,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createNote, getNotes, type NoteResponse } from '../../api/notes';
import { getProject, type ProjectResponse } from '../../api/projects';
import { getResearchList } from '../../api/research';
import { getYouTubePreview } from '../../api/youtube';
import { createTodo, deleteTodo, getTodos, updateTodo } from '../../api/todos';
import type { ResearchTopic as ApiResearchTopic, TodoItem } from '../../api/types';

type ProjectTab = 'overview' | 'notes' | 'research' | 'videos' | 'tasks';
type QuickFilter = 'all' | 'starred' | 'in-progress' | 'completed';
type TaskStatusFilter = 'open' | 'all';
type TaskBucket = 'today' | 'next' | 'later';
type TaskDropTarget = TaskBucket | 'done';
type TaskDropInfo = {
  bucket: TaskDropTarget;
  targetTodoId?: string;
  insertAfter?: boolean;
};
type CompletedFilter = 'today' | 'all';

const TASK_COLOR_OPTIONS = [
  { label: 'Mint', value: '#00D4AA' },
  { label: 'Cyan', value: '#4DC8E8' },
  { label: 'Violet', value: '#A78BFA' },
  { label: 'Sky', value: '#38BDF8' },
  { label: 'Rose', value: '#FB7185' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Lime', value: '#84CC16' },
  { label: 'Indigo', value: '#818CF8' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Purple', value: '#C084FC' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Yellow', value: '#FACC15' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Slate', value: '#64748B' },
] as const;

interface VideoLibraryItem {
  id: string;
  status: string;
  sourceProvider: string;
  sourceKind: string;
  sourceUrl: string;
  language: string | null;
  durationSeconds: number | null;
  transcriptId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  channel: string;
}

function fallbackVideoPreview(url: string): { title: string; channel: string } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      return {
        title: 'YouTube video',
        channel: 'YouTube',
      };
    }
  } catch {
    // fallback below
  }

  return {
    title: 'Video transcript',
    channel: 'Video',
  };
}

async function loadVideoLibraryItems(): Promise<VideoLibraryItem[]> {
  const params = new URLSearchParams();
  params.set('requestedByUserId', getCurrentUserId());
  params.set('status', 'completed');
  params.set('limit', '200');
  params.set('offset', '0');

  const response = await fetch(`/api/transcripts/library?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch video library');
  }

  const items = await response.json() as Array<{
    id: string;
    status: string;
    sourceProvider: string;
    sourceKind: string;
    sourceUrl: string;
    language: string | null;
    durationSeconds: number | null;
    transcriptId: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;

  const completedVideos = items.filter((item) => item.status === 'completed' && item.sourceKind.toLowerCase() === 'video');

  return Promise.all(completedVideos.map(async (item) => {
    const preview = await getYouTubePreview(item.sourceUrl).catch(() => null);
    const fallback = fallbackVideoPreview(item.sourceUrl);
    return {
      ...item,
      title: preview?.title ?? fallback.title,
      channel: preview?.channel ?? fallback.channel,
    };
  }));
}

function navigateTo(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function normalizeProjectStatus(status?: string | null): 'active' | 'archived' | 'deleted' | 'unknown' {
  switch ((status ?? '').toLowerCase()) {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isLightHexColor(hex: string): boolean {
  const value = hex.replace('#', '').trim();
  if (value.length !== 6) return false;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return false;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.64;
}

function getTaskColorTheme(hex: string): {
  foreground: string;
  mutedForeground: string;
  background: string;
  border: string;
  light: boolean;
} {
  const light = isLightHexColor(hex);
  const backgroundAlpha = light ? 0.20 : 0.18;
  const borderAlpha = light ? 0.36 : 0.26;
  return {
    foreground: light ? '#081122' : '#F8FAFC',
    mutedForeground: light ? 'rgba(8, 17, 34, 0.72)' : 'rgba(248, 250, 252, 0.72)',
    background: light ? `rgba(8, 17, 34, ${backgroundAlpha})` : `rgba(255, 255, 255, ${backgroundAlpha})`,
    border: light ? `rgba(8, 17, 34, ${borderAlpha})` : `rgba(255, 255, 255, ${borderAlpha})`,
    light,
  };
}

function toRgba(hex: string, alpha: number): string | null {
  const value = hex.replace('#', '').trim();
  if (value.length !== 6) return null;

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeNote(value: unknown): NoteResponse | null {
  if (!isPlainObject(value)) return null;

  const now = new Date().toISOString();
  const createdAt = asString(value.createdAt, now);

  return {
    id: asString(value.id),
    requestedByUserId: asNullableString(value.requestedByUserId),
    projectId: asNullableString(value.projectId),
    projectName: asNullableString(value.projectName),
    title: asString(value.title, 'Untitled note'),
    status: asString(value.status, 'unknown'),
    sourceChannel: asString(value.sourceChannel, 'web'),
    inputKind: asString(value.inputKind, 'text'),
    primaryLanguage: asNullableString(value.primaryLanguage),
    currentTextVersionId: asNullableString(value.currentTextVersionId),
    summary: asNullableString(value.summary),
    createdAt,
    updatedAt: asString(value.updatedAt, createdAt),
  };
}

function normalizeResearchTopic(value: unknown): ApiResearchTopic | null {
  if (!isPlainObject(value)) return null;

  const now = new Date().toISOString();
  const createdAt = asString(value.createdAt, now);
  const updatedAt = asString(value.updatedAt, createdAt);

  return {
    id: asString(value.id),
    requestedByUserId: asNullableString(value.requestedByUserId),
    projectId: asNullableString(value.projectId),
    name: asString(value.name, 'Untitled topic'),
    description: asString(value.description, 'Research topic'),
    frequency: asString(value.frequency, 'daily') as ApiResearchTopic['frequency'],
    status: asString(value.status, 'draft') as ApiResearchTopic['status'],
    deliveryTime: asNullableString(value.deliveryTime),
    sources: Array.isArray(value.sources) ? value.sources.filter((item): item is string => typeof item === 'string') : [],
    tags: Array.isArray(value.tags) ? value.tags.filter((item): item is string => typeof item === 'string') : [],
    outputs: Array.isArray(value.outputs) ? value.outputs.filter((item): item is string => typeof item === 'string') : [],
    briefingsCount: asNumber(value.briefingsCount, 0),
    lastRunAt: asNullableString(value.lastRunAt),
    nextRunAt: asNullableString(value.nextRunAt),
    lastRun: formatRelative(asNullableString(value.lastRunAt)),
    nextRun: formatRelative(asNullableString(value.nextRunAt)),
    lastBriefingPreview: asString(value.lastBriefingPreview, ''),
    createdAt,
    updatedAt,
  };
}

function normalizeTodo(value: unknown): TodoItem | null {
  if (!isPlainObject(value)) return null;

  const now = new Date().toISOString();
  const createdAt = asString(value.createdAt, now);
  const updatedAt = asString(value.updatedAt, createdAt);

  return {
    id: asString(value.id),
    requestedByUserId: asNullableString(value.requestedByUserId),
    projectId: asNullableString(value.projectId),
    projectName: asNullableString(value.projectName),
    color: asNullableString(value.color),
    title: asString(value.title, 'Untitled task'),
    description: asNullableString(value.description),
    bucket: asString(value.bucket, 'today'),
    cadence: asString(value.cadence, 'target'),
    status: asString(value.status, 'open'),
    priority: asString(value.priority, 'medium'),
    dueAt: asNullableString(value.dueAt),
    completedAt: asNullableString(value.completedAt),
    sortOrder: asNumber(value.sortOrder, 0),
    createdAt,
    updatedAt,
  };
}

function normalizeNoteList(items: unknown): NoteResponse[] {
  return Array.isArray(items) ? items.map(normalizeNote).filter((item): item is NoteResponse => Boolean(item)) : [];
}

function normalizeResearchList(items: unknown): ApiResearchTopic[] {
  return Array.isArray(items)
    ? items.map(normalizeResearchTopic).filter((item): item is ApiResearchTopic => Boolean(item))
    : [];
}

function normalizeTodoList(items: unknown): TodoItem[] {
  return Array.isArray(items) ? items.map(normalizeTodo).filter((item): item is TodoItem => Boolean(item)) : [];
}

function compareUpdatedDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function compareAnyUpdatedDesc(a: { updatedAt?: string | null; createdAt?: string | null; date?: string | null }, b: { updatedAt?: string | null; createdAt?: string | null; date?: string | null }): number {
  const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? a.date ?? '');
  const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? b.date ?? '');
  return bTime - aTime;
}

function isSameDay(value: string | null | undefined, other = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === other.getFullYear() &&
    date.getMonth() === other.getMonth() &&
    date.getDate() === other.getDate()
  );
}

function isBeforeToday(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function formatShortMonthDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function normalizeTaskBucket(value?: string | null): TaskBucket {
  if (value === 'next' || value === 'later') return value;
  return 'today';
}

function getTaskBucket(todo: TodoItem): TaskDropTarget {
  return todo.status === 'done' ? 'done' : normalizeTaskBucket(todo.bucket);
}

function bucketLabel(bucket: TaskBucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
}

function buildSortedBucketTasks(tasks: TodoItem[], bucket: TaskDropTarget): TodoItem[] {
  return tasks.filter((task) => getTaskBucket(task) === bucket).sort(sortTasksForDisplay);
}

function reindexTasks(tasks: TodoItem[]): TodoItem[] {
  return tasks.map((task, index) => ({
    ...task,
    sortOrder: (index + 1) * 10,
  }));
}

function resolveDragDropInfo(clientX: number, clientY: number): TaskDropInfo | null {
  const element = document.elementFromPoint(clientX, clientY);
  const zone = element?.closest<HTMLElement>('[data-task-dropzone]');
  const value = zone?.dataset.taskDropzone;
  if (value === 'today' || value === 'next' || value === 'later' || value === 'done') {
    const rows = zone ? Array.from(zone.querySelectorAll<HTMLElement>('[data-task-row]')).filter((row) => Boolean(row.dataset.taskRowId)) : [];
    if (rows.length === 0) {
      return { bucket: value };
    }

    for (const row of rows) {
      const rowId = row.dataset.taskRowId;
      if (!rowId) continue;
      const rect = row.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        return { bucket: value, targetTodoId: rowId, insertAfter: false };
      }
    }

    const lastRowId = rows[rows.length - 1].dataset.taskRowId;
    if (lastRowId) {
      return { bucket: value, targetTodoId: lastRowId, insertAfter: true };
    }
    return { bucket: value };
  }
  return null;
}

function reorderTasksForDrop(tasks: TodoItem[], draggedId: string, dropInfo: TaskDropInfo): TodoItem[] {
  const dragged = tasks.find((task) => task.id === draggedId);
  if (!dragged) return tasks;

  const sourceBucket = getTaskBucket(dragged);
  const targetBucket = dropInfo.bucket;
  const sourceIsDone = sourceBucket === 'done';
  const targetIsDone = targetBucket === 'done';

  const sourceItems = buildSortedBucketTasks(tasks, sourceBucket).filter((task) => task.id !== draggedId);
  const targetItems = sourceBucket === targetBucket ? sourceItems : buildSortedBucketTasks(tasks, targetBucket);

  if (dropInfo.targetTodoId && dropInfo.targetTodoId === draggedId && sourceBucket === targetBucket) {
    return tasks;
  }

  const draggedNext: TodoItem = {
    ...dragged,
    bucket: targetIsDone ? dragged.bucket : targetBucket,
    status: targetIsDone ? 'done' : sourceIsDone ? 'open' : dragged.status,
  };

  const targetIndex = dropInfo.targetTodoId
    ? Math.max(0, targetItems.findIndex((task) => task.id === dropInfo.targetTodoId))
    : targetItems.length;
  const insertIndex = targetIndex < 0 ? targetItems.length : targetIndex + (dropInfo.insertAfter ? 1 : 0);
  const nextTargetItems = [...targetItems];
  nextTargetItems.splice(insertIndex, 0, draggedNext);

  if (sourceBucket === targetBucket) {
    const nextOrdered = reindexTasks(nextTargetItems);
    const byId = new Map(nextOrdered.map((task) => [task.id, task]));
    return tasks.map((task) => byId.get(task.id) ?? task);
  }

  const nextSourceItems = reindexTasks(sourceItems);
  const nextTargetReindexed = reindexTasks(nextTargetItems);
  const byId = new Map<string, TodoItem>();
  for (const task of [...nextSourceItems, ...nextTargetReindexed]) {
    byId.set(task.id, task);
  }

  return tasks.map((task) => byId.get(task.id) ?? task);
}

function buildTodoUpdatePayload(todo: TodoItem): {
  projectId: string | null;
  bucket: TaskBucket;
  color: string | null;
  title: string;
  description: string;
  cadence: string;
  status: string;
  priority: string;
  dueAt: string | null;
  sortOrder: number;
} {
  return {
    projectId: todo.projectId,
    bucket: normalizeTaskBucket(todo.bucket),
    color: todo.color ?? null,
    title: todo.title,
    description: todo.description ?? '',
    cadence: todo.cadence,
    status: todo.status,
    priority: todo.priority,
    dueAt: todo.dueAt,
    sortOrder: todo.sortOrder,
  };
}

function DropInsertionMarker({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      className="pointer-events-none mx-1 rounded-[18px] border border-accent/30 bg-[linear-gradient(90deg,rgba(0,212,170,0.12),rgba(0,212,170,0.05),rgba(0,212,170,0.12))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(0,212,170,0.04)]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-bg-primary/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(0,212,170,0.65)]" />
          <span>{title}</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      </div>
      <div className="mt-2 text-center text-[11px] text-text-muted">{hint}</div>
    </div>
  );
}

function TaskColorPicker({
  color,
  fallbackColor,
  onChange,
}: {
  color: string | null;
  fallbackColor: string;
  onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasExplicitColor = Boolean(color);
  const currentColor = color ?? fallbackColor;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (event.target instanceof Element && event.target.closest('[data-task-color-picker]')) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div className="relative" data-task-color-picker>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        aria-label="Change task color"
      >
        {hasExplicitColor ? (
          <span className="h-3 w-3 rounded-full border border-white/15" style={{ backgroundColor: currentColor }} />
        ) : (
          <span className="h-3 w-3 rounded-full border border-text-muted/60 bg-transparent" />
        )}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[220px] rounded-2xl border border-border bg-bg-secondary p-3 shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-text-secondary">
            <Palette size={12} className="text-accent" />
            Color
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-bg-primary/65 px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          >
            <span className="h-4 w-4 rounded-full border border-border bg-bg-input" />
            No color
          </button>
          <div className="grid grid-cols-5 gap-1.5">
            {TASK_COLOR_OPTIONS.map((option) => {
              const active = color?.toUpperCase() === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex h-9 items-center justify-center rounded-xl border transition-colors ${
                    active ? 'ring-2 ring-accent/60 ring-offset-2 ring-offset-bg-secondary' : 'hover:scale-[1.03]'
                  }`}
                  style={{
                    backgroundColor: option.value,
                    borderColor: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)',
                  }}
                  aria-label={`Set color ${option.label}`}
                  title={option.label}
                >
                  <span className="sr-only">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function taskDueBadge(todo: TodoItem): string | null {
  if (todo.status === 'done') {
    return todo.completedAt ? formatShortMonthDay(todo.completedAt) : 'Done';
  }
  if (!todo.dueAt) return null;
  if (isSameDay(todo.dueAt)) return 'Due today';
  if (isBeforeToday(todo.dueAt)) return 'Overdue';
  return `Due ${formatShortMonthDay(todo.dueAt)}`;
}

function sortTasksForDisplay(a: TodoItem, b: TodoItem): number {
  const aDone = a.status === 'done';
  const bDone = b.status === 'done';
  if (aDone !== bDone) return aDone ? 1 : -1;

  if (!aDone && !bDone) {
    const bucketRank = (bucket: TaskBucket): number => {
      switch (bucket) {
        case 'today':
          return 0;
        case 'next':
          return 1;
        case 'later':
          return 2;
      }
    };
    const aBucket = bucketRank(normalizeTaskBucket(a.bucket));
    const bBucket = bucketRank(normalizeTaskBucket(b.bucket));
    if (aBucket !== bBucket) return aBucket - bBucket;
  }

  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (aDone && bDone) {
    const aCompleted = a.completedAt ? Date.parse(a.completedAt) : Number.NEGATIVE_INFINITY;
    const bCompleted = b.completedAt ? Date.parse(b.completedAt) : Number.NEGATIVE_INFINITY;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
  } else {
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
  }
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>;
}

function SectionCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    tone?: 'primary' | 'secondary';
  }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        {actions?.length ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  action.tone === 'primary'
                    ? 'border-accent/25 bg-accent/10 text-accent hover:bg-accent/15'
                    : 'border-border bg-bg-primary/60 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                {action.icon ? <span className="text-accent">{action.icon}</span> : null}
                {action.label}
              </button>
            ))}
          </div>
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

function TaskRow({
  todo,
  bucket,
  dropPreview,
  projectName,
  accentColor,
  dueLabel,
  onRename,
  onChangeColor,
  onToggle,
  onMove,
  onDelete,
  onDragStart,
  dragging,
}: {
  todo: TodoItem;
  bucket: TaskDropTarget;
  dropPreview: TaskDropInfo | null;
  projectName: string;
  accentColor: string;
  dueLabel: string | null;
  onRename: (title: string) => void;
  onChangeColor: (color: string | null) => void;
  onToggle: () => void;
  onMove: (bucket: TaskBucket) => void;
  onDelete: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  dragging: boolean;
}) {
  const done = todo.status === 'done';
  const taskAccent = todo.color ?? accentColor;
  const taskTheme = todo.color ? getTaskColorTheme(taskAccent) : null;
  const isDropTarget = dropPreview?.bucket === bucket && dropPreview.targetTodoId === todo.id;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(todo.title);
    }
  }, [isEditingTitle, todo.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(todo.title);
      setIsEditingTitle(false);
      return;
    }
    if (nextTitle !== todo.title) {
      onRename(nextTitle);
    }
    setIsEditingTitle(false);
  };

  const cancelEdit = () => {
    setTitleDraft(todo.title);
    setIsEditingTitle(false);
  };

  return (
    <div
      data-task-row
      data-task-row-id={todo.id}
      data-task-bucket={bucket}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${dragging ? 'opacity-50' : ''} ${isDropTarget ? 'ring-2 ring-accent/70 shadow-[0_0_0_1px_rgba(0,212,170,0.12),0_0_18px_rgba(0,212,170,0.18)]' : ''}`}
      style={{
        backgroundColor: todo.color ? taskAccent : 'rgba(12, 18, 33, 0.92)',
        boxShadow: todo.color ? `inset 0 0 0 1px ${taskTheme?.border ?? 'rgba(255,255,255,0.18)'}` : 'inset 0 0 0 1px rgba(255,255,255,0.03)',
        color: taskTheme?.foreground,
      }}
    >
      <button
        type="button"
        onPointerDown={onDragStart}
        className="touch-none rounded-full p-1 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        style={taskTheme ? { color: taskTheme.mutedForeground } : undefined}
        aria-label="Drag to move task"
      >
        <GripVertical size={14} />
      </button>

      <button
        type="button"
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
          done
            ? 'text-bg-primary'
            : 'border-border bg-bg-card text-text-muted hover:border-accent/40 hover:bg-accent/10'
        }`}
        style={{
          borderColor: done
            ? (taskTheme ? taskTheme.border : taskAccent)
            : (taskTheme ? taskTheme.border : undefined),
          backgroundColor: done
            ? (taskTheme ? taskTheme.foreground : taskAccent)
            : (taskTheme ? (toRgba(taskAccent, taskTheme.light ? 0.24 : 0.18) ?? undefined) : undefined),
          color: done
            ? (taskTheme ? taskAccent : '#081122')
            : (taskTheme ? taskTheme.foreground : taskAccent),
        }}
        aria-label={done ? 'Mark task as open' : 'Mark task as done'}
      >
        {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </button>

      <div className="min-w-0 flex-1">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
              }
            }}
            className="w-full rounded-xl border border-accent/30 bg-bg-primary/85 px-3 py-1.5 text-[13px] font-medium text-text-primary outline-none ring-0 placeholder:text-text-muted focus:border-accent/60"
            style={taskTheme ? { color: done ? taskTheme.mutedForeground : taskTheme.foreground } : undefined}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className={`w-full truncate text-left text-[13px] font-medium ${done ? 'line-through' : ''}`}
            style={taskTheme ? { color: done ? taskTheme.mutedForeground : taskTheme.foreground } : undefined}
            aria-label="Edit task title"
          >
            {todo.title}
          </button>
        )}
        {todo.description ? (
          <div className="mt-0.5 truncate text-[11px] text-text-secondary" style={taskTheme ? { color: taskTheme.mutedForeground } : undefined}>
            {todo.description}
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted" style={taskTheme ? { color: taskTheme.mutedForeground } : undefined}>
          <Link2 size={11} />
          <span className="truncate">linked to: {projectName}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {dueLabel ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              todo.color
                ? ''
                : done
                ? 'border-border bg-bg-card text-text-muted'
                : dueLabel === 'Due today'
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : dueLabel === 'Overdue'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-border bg-bg-card text-text-secondary'
            }`}
            style={taskTheme ? { backgroundColor: taskTheme.background, borderColor: taskTheme.border, color: taskTheme.foreground } : undefined}
          >
            {dueLabel}
          </span>
        ) : null}

        <span
          className="hidden items-center gap-2 text-[12px] text-text-secondary lg:inline-flex"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          {projectName}
        </span>

        <TaskColorPicker color={todo.color} fallbackColor={accentColor} onChange={onChangeColor} />

        <details className="relative z-20">
          <summary className="list-none cursor-pointer rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
            <MoreVertical size={14} />
          </summary>
          <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-border bg-bg-secondary p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
            {(['today', 'next', 'later'] as const).map((bucket) => (
              <button
                key={bucket}
                type="button"
                onClick={(event) => {
                  (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                  onMove(bucket);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
              >
                <Clock3 size={13} />
                Move to {bucket.charAt(0).toUpperCase() + bucket.slice(1)}
              </button>
            ))}
            <button
              type="button"
              onClick={(event) => {
                (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                onToggle();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            >
              {done ? <Circle size={13} /> : <CheckCircle2 size={13} />}
              {done ? 'Reopen' : 'Mark done'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}

function TaskSectionGroup({
  sectionId,
  title,
  label,
  count,
  icon,
  description,
  headerRight,
  dropTarget,
  dropPreview,
  dragging,
  children,
}: {
  sectionId: TaskDropTarget;
  title: string;
  label: string;
  count: number;
  icon: ReactNode;
  description?: string;
  headerRight?: ReactNode;
  dropTarget: TaskDropTarget | null;
  dropPreview: TaskDropInfo | null;
  dragging: boolean;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const activePreview = dropPreview?.bucket === sectionId ? dropPreview : null;
  const isActiveDrop = dragging && dropTarget === sectionId;
  const [markerTop, setMarkerTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !activePreview) {
      setMarkerTop(null);
      return;
    }

    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-task-row]')).filter((row) => Boolean(row.dataset.taskRowId));
    if (rows.length === 0) {
      setMarkerTop(0);
      return;
    }

    const containerRect = list.getBoundingClientRect();
    const targetRow = activePreview.targetTodoId ? rows.find((row) => row.dataset.taskRowId === activePreview.targetTodoId) : null;
    if (!targetRow) {
      const firstRect = rows[0].getBoundingClientRect();
      setMarkerTop(Math.max(0, firstRect.top - containerRect.top - 10));
      return;
    }

    const targetRect = targetRow.getBoundingClientRect();
    const top = activePreview.insertAfter ? targetRect.bottom - containerRect.top : targetRect.top - containerRect.top;
    setMarkerTop(Math.max(0, top - 22));
  }, [activePreview]);

  return (
    <div
      data-task-dropzone={sectionId}
      className={`rounded-[24px] border p-4 sm:p-5 ${isActiveDrop ? 'border-accent/60 ring-1 ring-accent/30' : 'border-border'}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          <h3 className="text-[14px] font-semibold text-text-primary">{label}</h3>
          <span className="rounded-full border border-border bg-bg-primary/65 px-2 py-0.5 text-[11px] text-text-muted">{count}</span>
        </div>
        {description ? <div className="hidden text-[12px] text-text-secondary lg:block">{description}</div> : null}
        {headerRight ? <div className="ml-auto">{headerRight}</div> : null}
      </div>

      <div ref={listRef} className="relative mt-4 overflow-visible rounded-[20px] border border-border bg-bg-primary/40 p-2">
        <div className="space-y-2">{children}</div>
        {activePreview ? (
          <div
            className="pointer-events-none absolute left-2 right-2 z-20 transition-transform duration-150 ease-out"
            style={{ top: markerTop ?? 0 }}
            aria-hidden="true"
          >
            <DropInsertionMarker
              title="Drop here"
              hint={
                activePreview.targetTodoId
                  ? `Between tasks in ${title}`
                  : `Release to place the task in ${title}`
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-4 py-6 text-[12px] text-text-muted">{label}</div>;
}

function ProjectNoteCreateModal({
  projectName,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSubmit,
}: {
  projectName: string;
  form: {
    title: string;
    summary: string;
  };
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onChange: (form: {
    title: string;
    summary: string;
  }) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[680px] rounded-[28px] border border-border bg-bg-secondary shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-primary/65 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              <PencilLine size={12} />
              New note
            </div>
            <h3 className="mt-3 text-[18px] font-semibold text-text-primary">Add a note to {projectName}</h3>
            <p className="mt-1 text-[12px] text-text-secondary">
              Keep this lightweight. Title and summary are enough to capture the idea quickly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            aria-label="Close new note dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-red-300">
              {error}
            </div>
          ) : null}

          <label className="block">
            <div className="mb-2 text-[12px] font-medium text-text-secondary">Title</div>
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Meeting recap, article note, voice idea..."
              className="w-full rounded-2xl border border-border bg-bg-primary/65 px-4 py-3 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/40"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-[12px] font-medium text-text-secondary">Summary</div>
            <textarea
              value={form.summary}
              onChange={(event) => onChange({ ...form, summary: event.target.value })}
              placeholder="What should you remember from this note?"
              rows={5}
              className="w-full resize-none rounded-2xl border border-border bg-bg-primary/65 px-4 py-3 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/40"
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-border bg-bg-primary/60 px-4 py-2.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || (!form.title.trim() && !form.summary.trim())}
            className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2.5 text-[12px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create note'}
          </button>
        </div>
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
  const [videoLibraryItems, setVideoLibraryItems] = useState<VideoLibraryItem[]>([]);
  const [researchTopics, setResearchTopics] = useState<ApiResearchTopic[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [taskDraft, setTaskDraft] = useState('');
  const [taskColor, setTaskColor] = useState<string | null>(null);
  const [taskBucket, setTaskBucket] = useState<TaskBucket>('today');
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('open');
  const [taskSearch, setTaskSearch] = useState('');
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('today');
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [noteCreateSaving, setNoteCreateSaving] = useState(false);
  const [noteCreateError, setNoteCreateError] = useState<string | null>(null);
  const [noteCreateForm, setNoteCreateForm] = useState({
    title: '',
    summary: '',
  });
  const dragStateRef = useRef<{ todo: TodoItem; pointerId: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const [dropPreview, setDropPreview] = useState<TaskDropInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getProject(projectId),
      getNotes({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 }),
      loadVideoLibraryItems(),
      getResearchList(getCurrentUserId()),
      getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 }),
    ])
      .then(([projectData, noteList, videoList, researchList, todoList]) => {
        if (!mounted) return;
        setProject(projectData);
        setNotes(normalizeNoteList(noteList));
        setVideoLibraryItems(videoList);
        setResearchTopics(
          normalizeResearchList(researchList.topics).filter((topic) => topic.projectId === projectId),
        );
        setTodos(normalizeTodoList(todoList.items));
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
    const doneTasks = todos.filter((todo) => todo.status === 'done').length;
    const doingTasks = todos.filter((todo) => todo.status === 'doing').length;
    const activeResearch = researchTopics.filter((topic) => topic.status === 'active').length;
    const completedResearch = researchTopics.filter((topic) => topic.status === 'draft').length;

    return {
      notesCount: notes.length,
      researchCount: researchTopics.length,
      videoCount: videoLibraryItems.length,
      taskCount: todos.length,
      doneTasks,
      doingTasks,
      activeResearch,
      completedResearch,
      totalItems: notes.length + researchTopics.length + todos.length,
      completion: todos.length > 0 ? Math.round((doneTasks / todos.length) * 100) : Math.min(92, Math.max(18, Math.round(((notes.length + researchTopics.length + videoLibraryItems.length) / 30) * 100))),
    };
  }, [notes, researchTopics, todos, videoLibraryItems]);

  const projectAccent = project?.color ?? '#00d4aa';
  const selectedProjectIcon = renderProjectIcon(project?.icon);
  const projectTags = useMemo(() => {
    if (!project) return [];
    const aliases = Array.isArray(project.aliases) ? project.aliases : [];
    return [
      ...aliases.slice(0, 3),
      project.isDefault ? 'Default workspace' : null,
      project.status === 'active' ? 'Active' : null,
    ].filter((item): item is string => Boolean(item));
  }, [project]);

  const noteItems = useMemo(() => {
    const sorted = notes.slice().sort(compareUpdatedDesc);
    return activeTab === 'overview' ? sorted.slice(0, 4) : sorted;
  }, [activeTab, notes]);
  const researchItems = useMemo(() => {
    const sorted = researchTopics.slice().sort(compareUpdatedDesc);
    return activeTab === 'overview' ? sorted.slice(0, 4) : sorted;
  }, [activeTab, researchTopics]);
  const videoItems = useMemo(() => {
    const sorted = videoLibraryItems.slice().sort(compareUpdatedDesc);
    return activeTab === 'overview' ? sorted.slice(0, 3) : sorted;
  }, [activeTab, videoLibraryItems]);
  const searchedTodos = useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    return todos.filter((todo) => {
      if (!query) return true;
      const haystack = [todo.title, todo.description ?? '', todo.projectName ?? '', todo.bucket, todo.status, todo.priority]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [taskSearch, todos]);
  const filteredTodos = useMemo(
    () => searchedTodos.filter((todo) => (taskStatusFilter === 'open' ? todo.status !== 'done' && todo.status !== 'archived' : todo.status !== 'archived')),
    [searchedTodos, taskStatusFilter],
  );
  const taskSections = useMemo(() => {
    const activeSorted = [...filteredTodos].filter((todo) => todo.status !== 'done').sort(sortTasksForDisplay);
    const done = searchedTodos.filter((todo) => todo.status === 'done').sort(sortTasksForDisplay);
    const today = activeSorted.filter((todo) => normalizeTaskBucket(todo.bucket) === 'today');
    const next = activeSorted.filter((todo) => normalizeTaskBucket(todo.bucket) === 'next');
    const later = activeSorted.filter((todo) => normalizeTaskBucket(todo.bucket) === 'later');
    const doneToday = done.filter((todo) => todo.completedAt && isSameDay(todo.completedAt));
    return [
      { id: 'today' as const, label: 'Today', description: 'Tasks due today', icon: <span className="text-[15px]">☀</span>, count: today.length, items: today },
      { id: 'next' as const, label: 'Upcoming', description: 'Tasks coming up next', icon: <CalendarDays size={15} />, count: next.length, items: next },
      { id: 'later' as const, label: 'Later', icon: <Clock3 size={15} />, count: later.length, items: later },
      {
        id: 'done' as const,
        label: completedFilter === 'today' ? 'Done today' : 'Completed',
        description: 'Completed tasks',
        icon: <CheckCircle2 size={15} />,
        count: completedFilter === 'today' ? doneToday.length : done.length,
        items: completedFilter === 'today' ? doneToday : done,
        headerRight: (
          <div className="inline-flex rounded-full border border-border bg-bg-primary/65 p-1">
            <button
              type="button"
              onClick={() => setCompletedFilter('today')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                completedFilter === 'today' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Today only
            </button>
            <button
              type="button"
              onClick={() => setCompletedFilter('all')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                completedFilter === 'all' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All completed
            </button>
          </div>
        ),
      },
    ];
  }, [completedFilter, filteredTodos, searchedTodos]);
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

  const isOverview = activeTab === 'overview';
  const showNotes = isOverview || activeTab === 'notes';
  const showResearch = isOverview || activeTab === 'research';
  const showVideos = isOverview || activeTab === 'videos';
  const showTasks = isOverview || activeTab === 'tasks';
  const projectTaskCount = todos.length;
  const projectDoneCount = todos.filter((todo) => todo.status === 'done').length;

  const handleAddTask = async () => {
    const title = taskDraft.trim();
    if (!title || taskSaving) return;
    setTaskSaving(true);
    setTaskError(null);
    try {
      await createTodo({
        requestedByUserId: getCurrentUserId(),
        projectId,
        bucket: taskBucket,
        color: taskColor,
        title,
        description: null,
        cadence: 'target',
        status: 'open',
        priority: 'medium',
        dueAt: null,
        sortOrder: 0,
      });
      setTaskDraft('');
      setTaskColor(null);
      setTaskBucket('today');
      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTask = async (todo: TodoItem) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      await updateTodo(todo.id, {
        ...buildTodoUpdatePayload({
          ...todo,
          status: todo.status === 'done' ? 'open' : 'done',
        }),
      });
      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleRenameTask = async (todo: TodoItem, title: string) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      await updateTodo(todo.id, {
        ...buildTodoUpdatePayload({
          ...todo,
          title,
        }),
      });
      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleChangeTaskColor = async (todo: TodoItem, color: string | null) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      const updated = await updateTodo(todo.id, {
        ...buildTodoUpdatePayload({
          ...todo,
          color,
        }),
      });
      setTodos((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated, color } : item)));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleMoveTask = async (todo: TodoItem, target: TaskDropInfo) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      const nextTodos = reorderTasksForDrop(todos, todo.id, target);
      const currentById = new Map(todos.map((task) => [task.id, task]));
      const updates = nextTodos.filter((task) => {
        const current = currentById.get(task.id);
        if (!current) return false;
        return current.bucket !== task.bucket || current.status !== task.status || current.sortOrder !== task.sortOrder;
      });

      await Promise.all(
        updates.map((task) =>
          updateTodo(task.id, {
            ...buildTodoUpdatePayload(task),
          }),
        ),
      );

      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setTaskSaving(false);
    }
  };

  const resetTaskFilters = () => {
    setTaskSearch('');
    setTaskStatusFilter('open');
    setTaskBucketFilter('all');
  };

  const handleMoveTaskBucket = async (todo: TodoItem, bucket: TaskBucket) => {
    await handleMoveTask(todo, { bucket });
  };

  const handleDeleteTask = async (todoId: string) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      await deleteTodo(todoId);
      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setTaskSaving(false);
    }
  };

  const clearDragState = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragPointRef.current = null;
    dragStateRef.current = null;
    setDraggingTodoId(null);
    setDragPosition(null);
    setDropTarget(null);
    setDropPreview(null);
  };

  const beginDrag = (todo: TodoItem, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = { todo, pointerId: event.pointerId };
    setDraggingTodoId(todo.id);
    setDragPosition({ x: event.clientX, y: event.clientY });
    const initialDrop = { bucket: getTaskBucket(todo), targetTodoId: todo.id };
    setDropTarget(initialDrop.bucket);
    setDropPreview(initialDrop);

    const applyDragMove = (point: { x: number; y: number }) => {
      const nextTarget = resolveDragDropInfo(point.x, point.y);
      setDragPosition(point);
      setDropTarget(nextTarget?.bucket ?? null);
      setDropPreview(nextTarget);
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStateRef.current || moveEvent.pointerId !== dragStateRef.current.pointerId) return;
      pendingDragPointRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const point = pendingDragPointRef.current;
        if (!point || !dragStateRef.current) return;
        pendingDragPointRef.current = null;
        applyDragMove(point);
      });
    };

    const finishDrag = (endEvent: PointerEvent) => {
      if (!dragStateRef.current || endEvent.pointerId !== dragStateRef.current.pointerId) return;
      const draggedTodo = dragStateRef.current.todo;
      const target = resolveDragDropInfo(endEvent.clientX, endEvent.clientY);

      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      clearDragState();

      if (target) {
        void handleMoveTask(draggedTodo, target);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  const handleClearCompleted = async () => {
    const completedTasks = todos.filter((todo) => todo.status === 'done');
    if (completedTasks.length === 0 || taskSaving) return;
    setTaskSaving(true);
    setTaskError(null);
    try {
      await Promise.all(
        completedTasks.map((todo) =>
          updateTodo(todo.id, {
            projectId: todo.projectId,
            bucket: todo.bucket,
            color: todo.color ?? null,
            title: todo.title,
            description: todo.description ?? '',
            cadence: todo.cadence,
            status: 'archived',
            priority: todo.priority,
            dueAt: todo.dueAt,
            sortOrder: todo.sortOrder,
          }),
        ),
      );
      const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setTodos(normalizeTodoList(todoList.items));
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to clear completed tasks');
    } finally {
      setTaskSaving(false);
    }
  };

  type ProjectQuickAction = {
    label: string;
    action: () => void;
    icon: ReactNode;
    tone?: 'primary' | 'secondary';
  };

  const projectVideoImportPath = `/summarizer/new?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(project?.name ?? 'Project')}`;
  const projectNoteReturnPath = `/projects/${encodeURIComponent(projectId)}`;
  const projectNoteCreatePath = `/notes?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(project?.name ?? 'Project')}&create=1&returnTo=${encodeURIComponent(projectNoteReturnPath)}`;
  const projectResearchReturnPath = `/projects/${encodeURIComponent(projectId)}`;
  const projectResearchCreatePath = `/research/create?projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(project?.name ?? 'Project')}&returnTo=${encodeURIComponent(projectResearchReturnPath)}`;

  const projectQuickActions = useMemo(() => {
    const sections: ProjectQuickAction[] = [
      { label: 'Overview', action: () => setActiveTab('overview'), icon: <ArrowLeft size={13} /> },
      { label: 'Notes', action: () => setActiveTab('notes'), icon: <MessageSquareQuote size={13} /> },
      { label: 'Research', action: () => setActiveTab('research'), icon: <Sparkles size={13} /> },
      { label: 'Videos', action: () => setActiveTab('videos'), icon: <Play size={13} /> },
    ];

    const openNotes = { label: 'Notes list', action: () => setActiveTab('notes'), icon: <FolderKanban size={13} />, tone: 'secondary' as const };
    const newNote = { label: 'New note', action: () => navigateTo(projectNoteCreatePath), icon: <PencilLine size={13} />, tone: 'primary' as const };
    const openResearch = { label: 'Research list', action: () => setActiveTab('research'), icon: <Sparkles size={13} />, tone: 'secondary' as const };
    const newResearch = { label: 'New research', action: () => navigateTo(projectResearchCreatePath), icon: <Sparkles size={13} />, tone: 'primary' as const };
    const openVideos = { label: 'Videos list', action: () => setActiveTab('videos'), icon: <Play size={13} />, tone: 'secondary' as const };
    const importVideo = {
      label: 'Import video',
      action: () => navigateTo(projectVideoImportPath),
      icon: <Play size={13} />,
      tone: 'primary' as const,
    };

    switch (activeTab) {
      case 'notes':
        return [sections[0], openNotes, newNote, sections[2], sections[3]];
      case 'research':
        return [sections[0], sections[1], openResearch, newResearch, sections[3]];
      case 'videos':
        return [sections[0], sections[1], sections[2], openVideos, importVideo];
      default:
        return [sections[1], sections[2], sections[3]];
    }
  }, [activeTab, projectNoteCreatePath, projectResearchCreatePath, projectVideoImportPath]);

  const handleCreateNote = async () => {
    const title = noteCreateForm.title.trim();
    const summary = noteCreateForm.summary.trim();
    if ((!title && !summary) || noteCreateSaving) return;

    setNoteCreateSaving(true);
    setNoteCreateError(null);
    try {
      await createNote({
        requestedByUserId: getCurrentUserId(),
        projectId,
        title: title || null,
        sourceChannel: 'web',
        inputKind: 'text',
        summary: summary || null,
      });
      const noteList = await getNotes({ requestedByUserId: getCurrentUserId(), projectId, limit: 200, offset: 0 });
      setNotes(normalizeNoteList(noteList));
      setActiveTab('notes');
      setNoteCreateOpen(false);
      setNoteCreateForm({ title: '', summary: '' });
    } catch (err: unknown) {
      setNoteCreateError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setNoteCreateSaving(false);
    }
  };

  void taskError;
  void taskSections;
  void projectTaskCount;
  void projectDoneCount;
  void handleToggleTask;
  void handleClearCompleted;

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

  const projectName = typeof project.name === 'string' && project.name.trim() ? project.name : 'Untitled project';
  const projectDescription =
    typeof project.description === 'string' && project.description.trim()
      ? project.description
      : 'Central hub for tracking this project, related research, and work items.';

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
                    <h1 className="truncate text-[28px] font-semibold tracking-tight text-text-primary">{projectName}</h1>
                    <Star size={15} className="text-text-secondary" />
                  </div>
                  <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
                    {projectDescription}
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

            <details className="relative z-20">
              <summary className="list-none cursor-pointer rounded-xl border border-border bg-bg-card px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                <span className="inline-flex items-center gap-2">
                  <MoreVertical size={14} />
                  Actions
                </span>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-bg-secondary p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
                {projectQuickActions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={(event) => {
                      (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                      item.action();
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
                      item.tone === 'primary'
                        ? 'bg-accent/10 text-accent hover:bg-accent/15'
                        : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </details>
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
            {isOverview ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Notes" value={formatCount(metrics.notesCount)} sub={`${formatCount(notes.filter((note) => Boolean(note.summary)).length)} with summaries`} icon={<FolderKanban size={15} />} accent="#00d4aa" />
              <StatCard label="Research items" value={formatCount(metrics.researchCount)} sub={`${formatCount(metrics.activeResearch)} active`} icon={<Sparkles size={15} />} accent="#a78bfa" />
              <StatCard label="Videos / summaries" value={formatCount(metrics.videoCount)} sub={`${formatCount(metrics.videoCount)} transcribed videos`} icon={<Play size={15} />} accent="#4dc8e8" />
              <StatCard label="Tasks" value={formatCount(metrics.taskCount)} sub={`${formatCount(metrics.doneTasks)} completed`} icon={<Target size={15} />} accent="#60a5fa" />
            </div>
            ) : null}

            {showNotes && (
              <SectionCard
                title={isOverview ? 'Recent notes' : 'Notes'}
                actions={
                  isOverview
                    ? [
                        { label: 'Notes list', onClick: () => setActiveTab('notes'), icon: <ArrowRight size={12} /> },
                        { label: 'New note', onClick: () => navigateTo(projectNoteCreatePath), icon: <PencilLine size={12} />, tone: 'primary' },
                      ]
                    : [
                        { label: 'Overview', onClick: () => setActiveTab('overview'), icon: <ArrowRight size={12} /> },
                        { label: 'New note', onClick: () => navigateTo(projectNoteCreatePath), icon: <PencilLine size={12} />, tone: 'primary' },
                      ]
                }
              >
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
              <SectionCard
                title="Research"
                actions={
                  isOverview
                    ? [
                        { label: 'Research list', onClick: () => setActiveTab('research'), icon: <ArrowRight size={12} /> },
                        { label: 'New research', onClick: () => navigateTo(projectResearchCreatePath), icon: <Sparkles size={12} />, tone: 'primary' },
                      ]
                    : [
                        { label: 'Overview', onClick: () => setActiveTab('overview'), icon: <ArrowRight size={12} /> },
                        { label: 'New research', onClick: () => navigateTo(projectResearchCreatePath), icon: <Sparkles size={12} />, tone: 'primary' },
                      ]
                }
              >
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
              </SectionCard>
            )}

            {showVideos && (
              <SectionCard
                title={isOverview ? 'Videos / YouTube summaries' : 'Videos'}
                actions={
                  isOverview
                    ? [
                        { label: 'Videos list', onClick: () => setActiveTab('videos'), icon: <ArrowRight size={12} /> },
                        { label: 'Import video', onClick: () => navigateTo(projectVideoImportPath), icon: <Play size={12} />, tone: 'primary' },
                      ]
                    : [
                        { label: 'Overview', onClick: () => setActiveTab('overview'), icon: <ArrowRight size={12} /> },
                        { label: 'Import video', onClick: () => navigateTo(projectVideoImportPath), icon: <Play size={12} />, tone: 'primary' },
                      ]
                }
              >
                <div className="divide-y divide-border">
                  {videoItems.length === 0 ? (
                    <div className="px-1 py-6 text-center text-[12px] text-text-muted">No transcribed videos in your library yet.</div>
                  ) : (
                    videoItems.map((video) => (
                      <ItemRow
                        key={video.id}
                        icon={<Play size={14} />}
                        title={video.title}
                        meta={`${video.channel} · ${video.sourceProvider} · ${video.sourceKind}${video.language ? ` · ${video.language.toUpperCase()}` : ''}`}
                        time={formatRelative(video.completedAt ?? video.updatedAt)}
                        trailing={<StatusChip label={video.transcriptId ? 'Transcript ready' : 'Completed'} className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20" />}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {showTasks && (
              <section className="rounded-[24px] border border-border bg-bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h2 className="text-[16px] font-semibold text-text-primary sm:text-[18px]">Tasks</h2>
                    <p className="mt-1 text-[12px] text-text-secondary sm:text-[13px]">
                      Keep the project work visible, grouped, and easy to clear.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="rounded-full border border-border bg-bg-primary/65 px-2.5 py-1">{projectDoneCount} done</span>
                    <span className="rounded-full border border-border bg-bg-primary/65 px-2.5 py-1">{projectTaskCount} total</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 xl:flex-row">
                  <label className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-bg-primary/65 px-4 py-3">
                    <Plus size={16} className="shrink-0 text-text-muted" />
                    <input
                      value={taskDraft}
                      onChange={(e) => setTaskDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddTask();
                        }
                      }}
                      placeholder="Add a task for this project..."
                      className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
                    />
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary">
                    <Palette size={14} className="text-text-muted" />
                    <span>Color</span>
                    <div className="ml-auto">
                      <TaskColorPicker color={taskColor} fallbackColor={projectAccent} onChange={setTaskColor} />
                    </div>
                  </div>
                  <select
                    value={taskBucketFilter}
                    onChange={(e) => setTaskBucketFilter(e.target.value as TaskBucketFilter)}
                    className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
                  >
                    <option value="all">All buckets</option>
                    <option value="today">Today</option>
                    <option value="next">Next</option>
                    <option value="later">Later</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAddTask()}
                    disabled={taskSaving || !taskDraft.trim()}
                    className="inline-flex items-center justify-center rounded-2xl border border-border bg-bg-input px-5 py-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 xl:w-[112px]"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-bg-card px-4 py-3">
                    <Search size={15} className="text-text-muted" />
                    <input
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
                    />
                  </label>
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value as TaskStatusFilter)}
                    className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
                  >
                    <option value="open">Open only</option>
                    <option value="all">All tasks</option>
                  </select>
                  <button
                    type="button"
                    onClick={resetTaskFilters}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                  >
                    <Filter size={15} className="text-accent" />
                    Filters
                  </button>
                </div>

                {taskError && (
                  <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-red-300">
                    {taskError}
                  </div>
                )}

                <div className="mt-6 space-y-6">
                  {taskSections.map((section) => {
                    if (taskStatusFilter === 'open' && section.id === 'done') return null;

                    return (
                      <TaskSectionGroup
                        key={section.id}
                        sectionId={section.id}
                        title={section.label}
                        label={section.label}
                        count={section.count}
                        icon={section.icon}
                        description={'description' in section ? section.description : undefined}
                        headerRight={'headerRight' in section ? section.headerRight : undefined}
                        dropTarget={dropTarget}
                        dropPreview={dropPreview}
                        dragging={Boolean(draggingTodoId)}
                      >
                        {section.items.length === 0 ? (
                          <EmptyState label={section.id === 'done' ? 'No completed tasks yet.' : 'No tasks in this section.'} />
                        ) : (
                          section.items.map((todo) => (
                            <TaskRow
                              key={todo.id}
                              todo={todo}
                              bucket={section.id}
                              dropPreview={dropPreview?.bucket === section.id ? dropPreview : null}
                              projectName={project.name}
                              accentColor={projectAccent}
                              dueLabel={taskDueBadge(todo)}
                              onRename={(title) => void handleRenameTask(todo, title)}
                              onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                              onToggle={() => void handleToggleTask(todo)}
                              onMove={(bucket) => void handleMoveTaskBucket(todo, bucket)}
                              onDelete={() => void handleDeleteTask(todo.id)}
                              onDragStart={(event) => beginDrag(todo, event)}
                              dragging={draggingTodoId === todo.id}
                            />
                          ))
                        )}
                      </TaskSectionGroup>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
                  <div>Showing {projectTaskCount} tasks</div>
                  <button
                    type="button"
                    onClick={() => void handleClearCompleted()}
                    disabled={projectDoneCount === 0 || taskSaving}
                    className="inline-flex items-center gap-2 self-start text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Archive size={14} />
                    Clear completed
                  </button>
                </div>
              </section>
            )}

            {isOverview ? (
              <SectionCard title="Activity feed">
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
            ) : null}
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

      {draggingTodoId && dragPosition ? (
        <div
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPosition.x, top: dragPosition.y }}
        >
          <div className="rounded-2xl border border-accent/40 bg-bg-secondary/95 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="text-[12px] font-medium text-text-primary">{todos.find((item) => item.id === draggingTodoId)?.title ?? 'Task'}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">
              Drop on {dropTarget ? (dropTarget === 'done' ? 'Done' : bucketLabel(dropTarget)) : 'a bucket'}
            </div>
          </div>
        </div>
      ) : null}

      {noteCreateOpen ? (
        <ProjectNoteCreateModal
          projectName={project.name}
          saving={noteCreateSaving}
          error={noteCreateError}
          form={noteCreateForm}
          onClose={() => {
            setNoteCreateOpen(false);
            setNoteCreateError(null);
            setNoteCreateForm({ title: '', summary: '' });
          }}
          onChange={setNoteCreateForm}
          onSubmit={() => void handleCreateNote()}
        />
      ) : null}
    </main>
  );
}
