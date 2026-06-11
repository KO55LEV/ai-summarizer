import {
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  GripVertical,
  Link2,
  MoreVertical,
  Plus,
  Search,
  Palette,
  Trash2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createTodo, deleteTodo, getTodos, updateTodo } from '../../api/todos';
import { getProjects, type ProjectResponse } from '../../api/projects';
import type { TodoItem, TodoListData } from '../../api/types';

type TaskStatusFilter = 'open' | 'all';
type TaskBucketFilter = 'all' | 'today' | 'next' | 'later';
type CompletedFilter = 'today' | 'all';
type TaskBucket = 'today' | 'next' | 'later';
type TaskDropTarget = TaskBucket | 'done';
type TaskDropInfo = {
  bucket: TaskDropTarget;
  targetTodoId?: string;
  insertAfter?: boolean;
};

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

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-sky-500/15 text-sky-300 border-sky-500/20' },
  doing: { label: 'Doing', className: 'bg-accent/15 text-accent border-accent/20' },
  blocked: { label: 'Blocked', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
  done: { label: 'Done', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  archived: { label: 'Archived', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' },
};

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function isSameDay(value: string | null | undefined, compare = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === compare.getFullYear() &&
    date.getMonth() === compare.getMonth() &&
    date.getDate() === compare.getDate()
  );
}

function formatDueBadge(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) return 'Overdue';
  if (isSameDay(value)) return 'Due today';
  return `Due ${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}`;
}

function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function normalizeBucket(value?: string | null): TaskBucket {
  if (value === 'next' || value === 'later') return value;
  return 'today';
}

function getBucketLabel(bucket: TaskBucket): string {
  switch (bucket) {
    case 'next':
      return 'Next';
    case 'later':
      return 'Later';
    case 'today':
    default:
      return 'Today';
  }
}

function isActiveStatus(status: string): boolean {
  return status === 'open' || status === 'doing' || status === 'blocked';
}

function projectColor(projects: ProjectResponse[], projectId: string | null): string {
  if (!projectId) return '#94a3b8';
  return projects.find((project) => project.id === projectId)?.color ?? '#94a3b8';
}

function taskSort(a: TodoItem, b: TodoItem): number {
  const aRank = a.status === 'done' ? 1 : 0;
  const bRank = b.status === 'done' ? 1 : 0;
  if (aRank !== bRank) return aRank - bRank;

  if (aRank === 0) {
    const aBucket = normalizeBucket(a.bucket);
    const bBucket = normalizeBucket(b.bucket);
    if (aBucket !== bBucket) {
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
      return bucketRank(aBucket) - bucketRank(bBucket);
    }
  }

  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function bucketLabel(bucket: TaskBucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
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

function getTaskBucket(todo: TodoItem): TaskDropTarget {
  return todo.status === 'done' ? 'done' : normalizeBucket(todo.bucket);
}

function buildSortedBucketTasks(tasks: TodoItem[], bucket: TaskDropTarget): TodoItem[] {
  return tasks.filter((task) => getTaskBucket(task) === bucket).sort(taskSort);
}

function reindexTasks(tasks: TodoItem[]): TodoItem[] {
  return tasks.map((task, index) => ({
    ...task,
    sortOrder: (index + 1) * 10,
  }));
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

function resolveDragDropInfo(clientX: number, clientY: number): TaskDropInfo | null {
  const element = document.elementFromPoint(clientX, clientY);
  const zone = element?.closest<HTMLElement>('[data-task-dropzone]');
  const value = zone?.dataset.taskDropzone;
  if (value === 'today' || value === 'next' || value === 'later' || value === 'done') {
    const rows = zone ? Array.from(zone.querySelectorAll<HTMLElement>('[data-task-row]')).filter((row) => row.dataset.taskRowId) : [];
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
    bucket: normalizeBucket(todo.bucket),
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

export default function TodoPage() {
  const [todosData, setTodosData] = useState<TodoListData | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDraft, setTaskDraft] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('open');
  const [bucketFilter, setBucketFilter] = useState<TaskBucketFilter>('all');
  const [addBucket, setAddBucket] = useState<TaskBucket>('today');
  const [addColor, setAddColor] = useState<string | null>(null);
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('today');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragStateRef = useRef<{ todo: TodoItem; pointerId: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const [dropPreview, setDropPreview] = useState<TaskDropInfo | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [todoList, projectList] = await Promise.all([
        getTodos({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 }),
        getProjects(getCurrentUserId()),
      ]);
      setTodosData(todoList);
      setProjects(projectList);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const projectOptions = useMemo(() => projects.slice().sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const tasks = todosData?.items ?? [];

  const scopedItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((item) => {
      if (item.status === 'archived') return false;
      if (projectFilter !== 'all' && item.projectId !== projectFilter) return false;
      if (query) {
        const haystack = [item.title, item.description ?? '', item.projectName ?? '', item.bucket, item.status, item.priority]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [projectFilter, search, tasks]);

  const openScopedItems = useMemo(
    () =>
      scopedItems
        .filter((item) => (statusFilter === 'open' ? isActiveStatus(item.status) : item.status !== 'archived' && item.status !== 'done'))
        .filter((item) => bucketFilter === 'all' || normalizeBucket(item.bucket) === bucketFilter)
        .sort(taskSort),
    [bucketFilter, scopedItems, statusFilter],
  );

  const doneItems = useMemo(
    () => scopedItems.filter((item) => item.status === 'done').sort(taskSort),
    [scopedItems],
  );

  const todayItems = useMemo(
    () => openScopedItems.filter((item) => normalizeBucket(item.bucket) === 'today'),
    [openScopedItems],
  );
  const nextItems = useMemo(
    () => openScopedItems.filter((item) => normalizeBucket(item.bucket) === 'next'),
    [openScopedItems],
  );
  const laterItems = useMemo(
    () => openScopedItems.filter((item) => normalizeBucket(item.bucket) === 'later'),
    [openScopedItems],
  );
  const doneTodayItems = useMemo(() => {
    const completedToday = doneItems.filter((item) => item.completedAt && isSameDay(item.completedAt));
    return completedToday;
  }, [doneItems]);
  const completedItems = useMemo(
    () => (completedFilter === 'today' ? doneTodayItems : doneItems),
    [completedFilter, doneItems, doneTodayItems],
  );

  const visibleCount = bucketFilter === 'all' ? openScopedItems.length + completedItems.length : openScopedItems.length;
  const showAllBuckets = bucketFilter === 'all';

  const resetFilters = () => {
    setSearch('');
    setProjectFilter('all');
    setStatusFilter('open');
    setBucketFilter('all');
  };

  const refreshTodos = async () => {
    const todoList = await getTodos({ requestedByUserId: getCurrentUserId(), limit: 500, offset: 0 });
    setTodosData(todoList);
  };

  const handleAddTask = async () => {
    const title = taskDraft.trim();
    if (!title || saving) return;

    setSaving(true);
    setAddError(null);
    try {
      await createTodo({
        requestedByUserId: getCurrentUserId(),
        projectId: projectFilter === 'all' ? null : projectFilter,
        bucket: addBucket,
        color: addColor,
        title,
        description: null,
        cadence: 'target',
        status: 'open',
        priority: 'medium',
        dueAt: null,
        sortOrder: 0,
      });
      setTaskDraft('');
      setAddBucket('today');
      setAddColor(null);
      await refreshTodos();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (todo: TodoItem, next: Partial<Pick<TodoItem, 'bucket' | 'status' | 'title' | 'color'>>) => {
    setSaving(true);
    setAddError(null);
    try {
      await updateTodo(todo.id, {
        ...buildTodoUpdatePayload({
          ...todo,
          bucket: next.bucket ?? normalizeBucket(todo.bucket),
          status: next.status ?? todo.status,
          title: next.title ?? todo.title,
          color: Object.prototype.hasOwnProperty.call(next, 'color') ? next.color ?? null : todo.color ?? null,
        }),
      });
      await refreshTodos();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (todo: TodoItem) => {
    await updateTask(todo, { status: todo.status === 'done' ? 'open' : 'done' });
  };

  const handleRenameTask = async (todo: TodoItem, title: string) => {
    await updateTask(todo, { title });
  };

  const handleChangeTaskColor = async (todo: TodoItem, color: string | null) => {
    setSaving(true);
    setAddError(null);
    try {
      const updated = await updateTodo(todo.id, {
        ...buildTodoUpdatePayload({
          ...todo,
          color,
        }),
      });
      setTodosData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === updated.id
                  ? {
                      ...item,
                      ...updated,
                      color,
                    }
                  : item,
              ),
            }
          : current,
      );
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const persistReorderedTasks = async (nextTasks: TodoItem[]) => {
    const currentById = new Map(tasks.map((task) => [task.id, task]));
    const updates = nextTasks.filter((task) => {
      const current = currentById.get(task.id);
      if (!current) return false;
      return current.bucket !== task.bucket || current.status !== task.status || current.sortOrder !== task.sortOrder;
    });

    if (updates.length === 0) return;

    await Promise.all(
      updates.map((task) =>
        updateTodo(task.id, {
          ...buildTodoUpdatePayload(task),
        }),
      ),
    );
    await refreshTodos();
  };

  const handleMoveTask = async (todo: TodoItem, target: TaskDropInfo) => {
    const nextTasks = reorderTasksForDrop(tasks, todo.id, target);
    await persistReorderedTasks(nextTasks);
  };

  const handleMoveBucket = async (todo: TodoItem, bucket: TaskBucket) => {
    await handleMoveTask(todo, { bucket });
  };

  const handleDelete = async (todoId: string) => {
    setSaving(true);
    setAddError(null);
    try {
      await deleteTodo(todoId);
      await refreshTodos();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setSaving(false);
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
    setDropTarget(getTaskBucket(todo));
    setDropPreview({ bucket: getTaskBucket(todo), targetTodoId: todo.id });

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
        void persistReorderedTasks(reorderTasksForDrop(tasks, draggedTodo.id, target));
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5">
        <section className="rounded-[24px] border border-border bg-[linear-gradient(135deg,rgba(0,212,170,0.08),rgba(12,18,33,0.96)_42%,rgba(7,12,22,1))] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.22)] sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[22px] font-semibold tracking-tight text-text-primary sm:text-[24px]">To-do</h1>
              <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary sm:text-[13px]">
                All project tasks in one place.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-[720px] xl:flex-1">
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-border bg-bg-primary/60 px-4 py-3">
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
                  placeholder="Add a task..."
                  className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
                />
              </div>
              <div className="flex items-center justify-center rounded-2xl border border-border bg-bg-card px-3 py-3">
                <TaskColorPicker
                  color={addColor}
                  fallbackColor={projectColor(projects, projectFilter === 'all' ? null : projectFilter)}
                  onChange={setAddColor}
                />
              </div>
              <select
                value={addBucket}
                onChange={(e) => setAddBucket(e.target.value as TaskBucket)}
                className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
              >
                <option value="today">Today</option>
                <option value="next">Next</option>
                <option value="later">Later</option>
              </select>
              <button
                type="button"
                onClick={() => void handleAddTask()}
                disabled={saving || !taskDraft.trim()}
                className="inline-flex items-center justify-center rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-[92px]"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px_auto]">
          <label className="flex items-center gap-2.5 rounded-2xl border border-border bg-bg-card px-4 py-3">
            <Search size={15} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
          >
            <option value="all">All projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatusFilter)}
            className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
          >
            <option value="open">Open only</option>
            <option value="all">All tasks</option>
          </select>

          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value as TaskBucketFilter)}
            className="rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-card-hover"
          >
            <option value="all">All buckets</option>
            <option value="today">Today</option>
            <option value="next">Next</option>
            <option value="later">Later</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg-card px-4 py-3 text-[13px] text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <Filter size={15} className="text-accent" />
            Filters
          </button>
        </section>

        {addError && (
          <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-red-300">
            {addError}
          </div>
        )}

        <section className="mt-5 space-y-5">
          {loading ? (
            <div className="rounded-[24px] border border-border bg-bg-card p-6 text-[13px] text-text-muted">Loading todo items...</div>
          ) : (
            <>
              {showAllBuckets ? (
                <>
                  <TaskGroup
                    title="Today"
                    bucket="today"
                    icon={<CheckCircle2 size={18} />}
                    count={todayItems.length}
                    description="Tasks planned for today"
                    dropTarget={dropTarget}
                    dropPreview={dropPreview}
                    dragging={Boolean(draggingTodoId)}
                  >
                    {todayItems.length === 0 ? (
                      <EmptyState label="No tasks in Today." />
                    ) : (
                      todayItems.map((todo) => (
                        <TaskRow
                          key={todo.id}
                          todo={todo}
                          bucket="today"
                          dropPreview={dropPreview}
                          projectColor={projectColor(projects, todo.projectId)}
                          done={todo.status === 'done'}
                          dueBadge={formatDueBadge(todo.dueAt)}
                          onRename={(title) => void handleRenameTask(todo, title)}
                          onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                          onToggle={() => void handleToggleDone(todo)}
                          onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                          onDelete={() => void handleDelete(todo.id)}
                          onDragStart={(event) => beginDrag(todo, event)}
                          dragging={draggingTodoId === todo.id}
                        />
                      ))
                    )}
                  </TaskGroup>

                  <TaskGroup
                    title="Upcoming"
                    bucket="next"
                    icon={<Clock3 size={18} />}
                    count={nextItems.length}
                    description="Tasks planned for next"
                    dropTarget={dropTarget}
                    dropPreview={dropPreview}
                    dragging={Boolean(draggingTodoId)}
                  >
                    {nextItems.length === 0 ? (
                      <EmptyState label="No tasks in Next." />
                    ) : (
                      nextItems.map((todo) => (
                        <TaskRow
                          key={todo.id}
                          todo={todo}
                          bucket="next"
                          dropPreview={dropPreview}
                          projectColor={projectColor(projects, todo.projectId)}
                          done={todo.status === 'done'}
                          dueBadge={formatDueBadge(todo.dueAt)}
                          onRename={(title) => void handleRenameTask(todo, title)}
                          onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                          onToggle={() => void handleToggleDone(todo)}
                          onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                          onDelete={() => void handleDelete(todo.id)}
                          onDragStart={(event) => beginDrag(todo, event)}
                          dragging={draggingTodoId === todo.id}
                        />
                      ))
                    )}
                  </TaskGroup>

                  <TaskGroup
                    title="Later"
                    bucket="later"
                    icon={<Clock3 size={18} />}
                    count={laterItems.length}
                    description="Tasks planned for later"
                    dropTarget={dropTarget}
                    dropPreview={dropPreview}
                    dragging={Boolean(draggingTodoId)}
                  >
                    {laterItems.length === 0 ? (
                      <EmptyState label="No tasks in Later." />
                    ) : (
                      laterItems.map((todo) => (
                        <TaskRow
                          key={todo.id}
                          todo={todo}
                          bucket="later"
                          dropPreview={dropPreview}
                          projectColor={projectColor(projects, todo.projectId)}
                          done={todo.status === 'done'}
                          dueBadge={formatDueBadge(todo.dueAt)}
                          onRename={(title) => void handleRenameTask(todo, title)}
                          onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                          onToggle={() => void handleToggleDone(todo)}
                          onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                          onDelete={() => void handleDelete(todo.id)}
                          onDragStart={(event) => beginDrag(todo, event)}
                          dragging={draggingTodoId === todo.id}
                        />
                      ))
                    )}
                  </TaskGroup>

                  {statusFilter === 'all' && (
                <TaskGroup
                  title={completedFilter === 'today' ? 'Done today' : 'Completed'}
                  bucket="done"
                  icon={<CheckCircle2 size={18} />}
                  count={completedItems.length}
                  description="Completed tasks"
                  headerRight={
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
                  }
                  dropTarget={dropTarget}
                  dropPreview={dropPreview}
                  dragging={Boolean(draggingTodoId)}
                >
                  {completedItems.length === 0 ? (
                    <EmptyState label="No completed tasks yet." />
                  ) : (
                    completedItems.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        bucket="done"
                        dropPreview={dropPreview}
                        projectColor={projectColor(projects, todo.projectId)}
                        done
                        dueBadge={todo.completedAt ? shortDate(todo.completedAt) : null}
                        onRename={(title) => void handleRenameTask(todo, title)}
                        onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                        onToggle={() => void handleToggleDone(todo)}
                        onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                        onDelete={() => void handleDelete(todo.id)}
                        onDragStart={(event) => beginDrag(todo, event)}
                        dragging={draggingTodoId === todo.id}
                      />
                    ))
                  )}
                </TaskGroup>
                  )}
                </>
              ) : bucketFilter === 'today' ? (
                <TaskGroup
                  title="Today"
                  bucket="today"
                  icon={<CheckCircle2 size={18} />}
                  count={todayItems.length}
                  description="Tasks planned for today"
                  dropTarget={dropTarget}
                  dropPreview={dropPreview}
                  dragging={Boolean(draggingTodoId)}
                >
                  {todayItems.length === 0 ? (
                    <EmptyState label="No tasks in Today." />
                  ) : (
                    todayItems.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        bucket="today"
                        dropPreview={dropPreview}
                        projectColor={projectColor(projects, todo.projectId)}
                        done={todo.status === 'done'}
                        dueBadge={formatDueBadge(todo.dueAt)}
                        onRename={(title) => void handleRenameTask(todo, title)}
                        onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                        onToggle={() => void handleToggleDone(todo)}
                        onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                        onDelete={() => void handleDelete(todo.id)}
                        onDragStart={(event) => beginDrag(todo, event)}
                        dragging={draggingTodoId === todo.id}
                      />
                    ))
                  )}
                </TaskGroup>
              ) : bucketFilter === 'next' ? (
                <TaskGroup
                  title="Upcoming"
                  bucket="next"
                  icon={<Clock3 size={18} />}
                  count={nextItems.length}
                  description="Tasks planned for next"
                  dropTarget={dropTarget}
                  dropPreview={dropPreview}
                  dragging={Boolean(draggingTodoId)}
                >
                  {nextItems.length === 0 ? (
                    <EmptyState label="No tasks in Next." />
                  ) : (
                    nextItems.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        bucket="next"
                        dropPreview={dropPreview}
                        projectColor={projectColor(projects, todo.projectId)}
                        done={todo.status === 'done'}
                        dueBadge={formatDueBadge(todo.dueAt)}
                        onRename={(title) => void handleRenameTask(todo, title)}
                        onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                        onToggle={() => void handleToggleDone(todo)}
                        onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                        onDelete={() => void handleDelete(todo.id)}
                        onDragStart={(event) => beginDrag(todo, event)}
                        dragging={draggingTodoId === todo.id}
                      />
                    ))
                  )}
                </TaskGroup>
              ) : (
                <TaskGroup
                  title="Later"
                  bucket="later"
                  icon={<Clock3 size={18} />}
                  count={laterItems.length}
                  description="Tasks planned for later"
                  dropTarget={dropTarget}
                  dropPreview={dropPreview}
                  dragging={Boolean(draggingTodoId)}
                >
                  {laterItems.length === 0 ? (
                    <EmptyState label="No tasks in Later." />
                  ) : (
                    laterItems.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        bucket="later"
                        dropPreview={dropPreview}
                        projectColor={projectColor(projects, todo.projectId)}
                        done={todo.status === 'done'}
                        dueBadge={formatDueBadge(todo.dueAt)}
                        onRename={(title) => void handleRenameTask(todo, title)}
                        onChangeColor={(color) => void handleChangeTaskColor(todo, color)}
                        onToggle={() => void handleToggleDone(todo)}
                        onMove={(bucket) => void handleMoveBucket(todo, bucket)}
                        onDelete={() => void handleDelete(todo.id)}
                        onDragStart={(event) => beginDrag(todo, event)}
                        dragging={draggingTodoId === todo.id}
                      />
                    ))
                  )}
                </TaskGroup>
              )}
            </>
          )}
        </section>

        <div className="mt-6 border-t border-border pt-4 text-center text-[12px] text-text-muted">
          Showing {formatCount(visibleCount)} tasks
        </div>
      </div>

      {draggingTodoId && dragPosition ? (
        <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2" style={{ left: dragPosition.x, top: dragPosition.y }}>
          <div className="rounded-2xl border border-accent/40 bg-bg-secondary/95 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="text-[12px] font-medium text-text-primary">{tasks.find((item) => item.id === draggingTodoId)?.title ?? 'Task'}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">
              Drop on {dropTarget ? (dropTarget === 'done' ? 'Done' : bucketLabel(dropTarget)) : 'a bucket'}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TaskGroup({
  title,
  bucket,
  icon,
  count,
  description,
  headerRight,
  dropTarget,
  dropPreview,
  dragging,
  children,
}: {
  title: string;
  bucket: TaskDropTarget;
  icon: ReactNode;
  count: number;
  description: string;
  headerRight?: ReactNode;
  dropTarget: TaskDropTarget | null;
  dropPreview: TaskDropInfo | null;
  dragging: boolean;
  children: ReactNode;
}) {
  const isActiveDrop = dragging && dropTarget === bucket;
  const activePreview = dropPreview?.bucket === bucket ? dropPreview : null;
  const listRef = useRef<HTMLDivElement | null>(null);
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
    <section
      data-task-dropzone={bucket}
      className={`rounded-[26px] border bg-[linear-gradient(180deg,rgba(10,18,34,0.96),rgba(9,15,29,0.98))] p-4 sm:p-5 ${
        isActiveDrop ? 'border-accent/60 ring-1 ring-accent/30' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-bg-card text-accent">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold text-text-primary sm:text-[18px]">{title}</h2>
            <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[11px] text-text-muted">
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-text-secondary">{description}</p>
        </div>
        {headerRight ? <div className="ml-auto">{headerRight}</div> : null}
      </div>

      <div ref={listRef} className="relative mt-4 overflow-visible rounded-[22px] border border-border bg-bg-primary/35 p-2">
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
                  ? `Between tasks in ${bucket === 'done' ? 'Done' : getBucketLabel(bucket as TaskBucket)}`
                  : `Release to place the task in ${bucket === 'done' ? 'Done' : getBucketLabel(bucket as TaskBucket)}`
              }
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-4 py-6 text-[12px] text-text-muted">{label}</div>;
}

function TaskRow({
  todo,
  bucket,
  dropPreview,
  projectColor,
  done,
  dueBadge,
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
  projectColor: string;
  done: boolean;
  dueBadge: string | null;
  onRename: (title: string) => void;
  onChangeColor: (color: string | null) => void;
  onToggle: () => void;
  onMove: (bucket: TaskBucket) => void;
  onDelete: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  dragging: boolean;
}) {
  const status = STATUS_META[todo.status] ?? STATUS_META.open;
  const taskColor = todo.color ?? projectColor;
  const taskTheme = todo.color ? getTaskColorTheme(taskColor) : null;
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
        backgroundColor: todo.color ? taskColor : 'rgba(12, 18, 33, 0.92)',
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
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
          done
            ? 'text-bg-primary'
            : 'border-border bg-bg-card text-text-muted hover:border-accent/40 hover:bg-accent/10'
        }`}
        style={{
          borderColor: done
            ? (taskTheme ? taskTheme.border : taskColor)
            : (taskTheme ? taskTheme.border : undefined),
          backgroundColor: done
            ? (taskTheme ? taskTheme.foreground : taskColor)
            : (taskTheme ? (toRgba(taskColor, taskTheme.light ? 0.22 : 0.16) ?? undefined) : undefined),
          color: done
            ? (taskTheme ? taskColor : '#081122')
            : (taskTheme ? taskTheme.foreground : taskColor),
        }}
        aria-label={done ? 'Mark task as open' : 'Mark task as done'}
      >
        {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
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
          <span className="truncate">linked to: {todo.projectName ?? 'No project'}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {dueBadge ? (
          <span
            className={`hidden rounded-full border px-2.5 py-1 text-[11px] sm:inline-flex ${
              todo.color
                ? ''
                : done
                ? 'border-border bg-bg-card text-text-muted'
                : dueBadge === 'Due today'
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : dueBadge === 'Overdue'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-border bg-bg-card text-text-secondary'
            }`}
            style={taskTheme ? { backgroundColor: taskTheme.background, borderColor: taskTheme.border, color: taskTheme.foreground } : undefined}
          >
            {dueBadge}
          </span>
        ) : null}

        <span
          className="hidden items-center gap-2 text-[12px] text-text-secondary lg:inline-flex"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: projectColor }} />
          {todo.projectName ?? 'No project'}
        </span>

        <TaskColorPicker color={todo.color} fallbackColor={projectColor} onChange={onChangeColor} />

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
                Move to {getBucketLabel(bucket)}
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

      <div className="hidden text-[11px] text-text-muted lg:block">{done ? status.label : null}</div>
    </div>
  );
}
