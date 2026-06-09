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
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createTodo, deleteTodo, getTodos, updateTodo } from '../../api/todos';
import { getProjects, type ProjectResponse } from '../../api/projects';
import type { TodoItem, TodoListData } from '../../api/types';

type TaskStatusFilter = 'open' | 'all';
type TaskBucketFilter = 'all' | 'today' | 'next' | 'later';
type CompletedFilter = 'today' | 'all';
type TaskBucket = 'today' | 'next' | 'later';
type TaskDropTarget = TaskBucket | 'done';

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

  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function bucketLabel(bucket: TaskBucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
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
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('today');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragStateRef = useRef<{ todo: TodoItem; pointerId: number } | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);

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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((item) => {
      if (item.status === 'archived') return false;
      if (projectFilter !== 'all' && item.projectId !== projectFilter) return false;
      if (statusFilter === 'open' && !isActiveStatus(item.status)) return false;
      if (bucketFilter !== 'all' && !isDone(item) && normalizeBucket(item.bucket) !== bucketFilter) return false;
      if (query) {
        const haystack = [item.title, item.description ?? '', item.projectName ?? '', item.bucket, item.status, item.priority]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [bucketFilter, projectFilter, search, statusFilter, tasks]);

  const activeItems = useMemo(
    () => filteredItems.filter((item) => item.status !== 'done').sort(taskSort),
    [filteredItems],
  );

  const doneItems = useMemo(
    () => filteredItems.filter((item) => item.status === 'done').sort(taskSort),
    [filteredItems],
  );

  const todayItems = useMemo(
    () => activeItems.filter((item) => normalizeBucket(item.bucket) === 'today'),
    [activeItems],
  );
  const nextItems = useMemo(
    () => activeItems.filter((item) => normalizeBucket(item.bucket) === 'next'),
    [activeItems],
  );
  const laterItems = useMemo(
    () => activeItems.filter((item) => normalizeBucket(item.bucket) === 'later'),
    [activeItems],
  );
  const doneTodayItems = useMemo(() => {
    const completedToday = doneItems.filter((item) => item.completedAt && isSameDay(item.completedAt));
    return completedToday;
  }, [doneItems]);
  const completedItems = useMemo(
    () => (completedFilter === 'today' ? doneTodayItems : doneItems),
    [completedFilter, doneItems, doneTodayItems],
  );

  const visibleCount = filteredItems.filter((item) => item.status !== 'archived').length;

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
      await refreshTodos();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (todo: TodoItem, next: Partial<Pick<TodoItem, 'bucket' | 'status'>>) => {
    setSaving(true);
    setAddError(null);
    try {
      await updateTodo(todo.id, {
        projectId: todo.projectId,
        bucket: next.bucket ?? normalizeBucket(todo.bucket),
        title: todo.title,
        description: todo.description ?? '',
        cadence: todo.cadence,
        status: next.status ?? todo.status,
        priority: todo.priority,
        dueAt: todo.dueAt,
        sortOrder: todo.sortOrder,
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

  const handleMoveBucket = async (todo: TodoItem, bucket: TaskBucket) => {
    await updateTask(todo, { bucket });
  };

  const handleMoveTask = async (todo: TodoItem, target: TaskDropTarget) => {
    if (target === 'done') {
      if (todo.status === 'done') return;
      await updateTask(todo, { status: 'done' });
      return;
    }

    if (todo.status === 'done') {
      await updateTask(todo, { status: 'open', bucket: target });
      return;
    }

    await updateTask(todo, { bucket: target });
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
    dragStateRef.current = null;
    setDraggingTodoId(null);
    setDragPosition(null);
    setDropTarget(null);
  };

  const getDropTargetFromPoint = (clientX: number, clientY: number): TaskDropTarget | null => {
    const element = document.elementFromPoint(clientX, clientY);
    const zone = element?.closest<HTMLElement>('[data-task-dropzone]');
    const value = zone?.dataset.taskDropzone;
    if (value === 'today' || value === 'next' || value === 'later' || value === 'done') {
      return value;
    }
    return null;
  };

  const beginDrag = (todo: TodoItem, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = { todo, pointerId: event.pointerId };
    setDraggingTodoId(todo.id);
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDropTarget(todo.status === 'done' ? 'done' : normalizeBucket(todo.bucket));

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStateRef.current || moveEvent.pointerId !== dragStateRef.current.pointerId) return;
      setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
      setDropTarget(getDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY));
    };

    const finishDrag = (endEvent: PointerEvent) => {
      if (!dragStateRef.current || endEvent.pointerId !== dragStateRef.current.pointerId) return;
      const draggedTodo = dragStateRef.current.todo;
      const target = getDropTargetFromPoint(endEvent.clientX, endEvent.clientY);

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
              <TaskGroup
                title="Today"
                bucket="today"
                icon={<CheckCircle2 size={18} />}
                count={todayItems.length}
                description="Tasks planned for today"
                dropTarget={dropTarget}
                dragging={Boolean(draggingTodoId)}
              >
                {todayItems.length === 0 ? (
                  <EmptyState label="No tasks in Today." />
                ) : (
                  todayItems.map((todo, index) => (
                    <TaskRow
                      key={todo.id}
                      todo={todo}
                      projectColor={projectColor(projects, todo.projectId)}
                      done={todo.status === 'done'}
                      dueBadge={formatDueBadge(todo.dueAt)}
                      index={index}
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
                dragging={Boolean(draggingTodoId)}
              >
                {nextItems.length === 0 ? (
                  <EmptyState label="No tasks in Next." />
                ) : (
                  nextItems.map((todo, index) => (
                    <TaskRow
                      key={todo.id}
                      todo={todo}
                      projectColor={projectColor(projects, todo.projectId)}
                      done={todo.status === 'done'}
                      dueBadge={formatDueBadge(todo.dueAt)}
                      index={index}
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
                dragging={Boolean(draggingTodoId)}
              >
                {laterItems.length === 0 ? (
                  <EmptyState label="No tasks in Later." />
                ) : (
                  laterItems.map((todo, index) => (
                    <TaskRow
                      key={todo.id}
                      todo={todo}
                      projectColor={projectColor(projects, todo.projectId)}
                      done={todo.status === 'done'}
                      dueBadge={formatDueBadge(todo.dueAt)}
                      index={index}
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
                  dragging={Boolean(draggingTodoId)}
                >
                  {completedItems.length === 0 ? (
                    <EmptyState label="No completed tasks yet." />
                  ) : (
                    completedItems.map((todo, index) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        projectColor={projectColor(projects, todo.projectId)}
                        done
                        dueBadge={todo.completedAt ? shortDate(todo.completedAt) : null}
                        index={index}
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
  dragging: boolean;
  children: ReactNode;
}) {
  const isActiveDrop = dragging && dropTarget === bucket;
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

      <div className="mt-4 overflow-visible rounded-[22px] border border-border bg-bg-primary/35">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-4 py-6 text-[12px] text-text-muted">{label}</div>;
}

function isDone(todo: TodoItem): boolean {
  return todo.status === 'done';
}

function TaskRow({
  todo,
  projectColor,
  done,
  dueBadge,
  index,
  onToggle,
  onMove,
  onDelete,
  onDragStart,
  dragging,
}: {
  todo: TodoItem;
  projectColor: string;
  done: boolean;
  dueBadge: string | null;
  index: number;
  onToggle: () => void;
  onMove: (bucket: TaskBucket) => void;
  onDelete: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  dragging: boolean;
}) {
  const status = STATUS_META[todo.status] ?? STATUS_META.open;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-border' : ''} ${dragging ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onPointerDown={onDragStart}
        className="touch-none rounded-full p-1 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        aria-label="Drag to move task"
      >
        <GripVertical size={14} />
      </button>

      <button
        type="button"
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
          done
            ? 'border-accent/40 bg-accent text-bg-primary'
            : 'border-border bg-bg-card text-text-muted hover:border-accent/40 hover:bg-accent/10'
        }`}
        aria-label={done ? 'Mark task as open' : 'Mark task as done'}
      >
        {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] font-medium ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {todo.title}
        </div>
        {todo.description ? <div className="mt-0.5 truncate text-[11px] text-text-secondary">{todo.description}</div> : null}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
          <Link2 size={11} />
          <span className="truncate">linked to: {todo.projectName ?? 'No project'}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {dueBadge ? (
          <span
            className={`hidden rounded-full border px-2.5 py-1 text-[11px] sm:inline-flex ${
              done
                ? 'border-border bg-bg-card text-text-muted'
                : dueBadge === 'Due today'
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : dueBadge === 'Overdue'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-border bg-bg-card text-text-secondary'
            }`}
          >
            {dueBadge}
          </span>
        ) : null}

        <span className="hidden items-center gap-2 text-[12px] text-text-secondary lg:inline-flex">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: projectColor }} />
          {todo.projectName ?? 'No project'}
        </span>

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
