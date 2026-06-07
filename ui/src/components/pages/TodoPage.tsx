import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Circle,
  Filter,
  FolderKanban,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentUserId } from '../../config/currentUser';
import { createTodo, deleteTodo, getTodos, updateTodo } from '../../api/todos';
import { getProjects, type ProjectResponse } from '../../api/projects';
import type { TodoItem, TodoListData, TodoStats } from '../../api/types';

type TodoFilter = 'all' | 'open' | 'doing' | 'blocked' | 'done' | 'archived';
type CadenceFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'target';

const CADENCE_ORDER: CadenceFilter[] = ['daily', 'weekly', 'monthly', 'yearly', 'target'];

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-sky-500/15 text-sky-300 border-sky-500/20' },
  doing: { label: 'Doing', className: 'bg-accent/15 text-accent border-accent/20' },
  blocked: { label: 'Blocked', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
  done: { label: 'Done', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  archived: { label: 'Archived', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' },
  medium: { label: 'Med', className: 'bg-sky-500/15 text-sky-300 border-sky-500/20' },
  high: { label: 'High', className: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  urgent: { label: 'Urgent', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
};

function navigateTo(path: string) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function formatDue(value: string | null): string {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function dueState(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffDays = Math.round((date.getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return '';
}

function statCard(label: string, value: number, sub: string) {
  return { label, value: new Intl.NumberFormat('en-US').format(value), sub };
}

export default function TodoPage() {
  const [todosData, setTodosData] = useState<TodoListData | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TodoFilter>('all');
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all');
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    projectId: 'none',
    cadence: 'daily',
    status: 'open',
    priority: 'medium',
    dueAt: '',
    sortOrder: 0,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [todoList, projectList] = await Promise.all([
        getTodos({
          requestedByUserId: getCurrentUserId(),
          projectId: projectFilter === 'all' ? undefined : projectFilter,
          cadence: cadenceFilter === 'all' ? undefined : cadenceFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 500,
          offset: 0,
        }),
        getProjects(getCurrentUserId()),
      ]);
      setTodosData(todoList);
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter, cadenceFilter, projectFilter]);

  const stats = todosData?.stats ?? {
    totalCount: 0,
    openCount: 0,
    doingCount: 0,
    blockedCount: 0,
    doneCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    projectLinkedCount: 0,
    targetCount: 0,
  } as TodoStats;

  const projectOptions = useMemo(() => projects.slice().sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const selectedTodo = useMemo(
    () => todosData?.items.find((item) => item.id === editingId) ?? null,
    [todosData?.items, editingId],
  );

  useEffect(() => {
    if (!selectedTodo) return;
    setForm({
      title: selectedTodo.title,
      description: selectedTodo.description ?? '',
      projectId: selectedTodo.projectId ?? 'none',
      cadence: selectedTodo.cadence,
      status: selectedTodo.status,
      priority: selectedTodo.priority,
      dueAt: selectedTodo.dueAt ? selectedTodo.dueAt.slice(0, 16) : '',
      sortOrder: selectedTodo.sortOrder,
    });
  }, [selectedTodo]);

  const filteredItems = useMemo(() => {
    const items = todosData?.items ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [item.title, item.description ?? '', item.projectName ?? '', item.cadence, item.status, item.priority]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, todosData?.items]);

  const grouped = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const item of filteredItems) {
      const bucket = map.get(item.cadence) ?? [];
      bucket.push(item);
      map.set(item.cadence, bucket);
    }

    return CADENCE_ORDER
      .map((key) => ({ key, items: map.get(key) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [filteredItems]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      projectId: 'none',
      cadence: 'daily',
      status: 'open',
      priority: 'medium',
      dueAt: '',
      sortOrder: 0,
    });
  };

  const submitForm = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        projectId: form.projectId === 'none' ? null : form.projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        cadence: form.cadence,
        status: form.status,
        priority: form.priority,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        sortOrder: form.sortOrder,
      };

      if (editingId) {
        await updateTodo(editingId, payload);
      } else {
        await createTodo({ requestedByUserId: getCurrentUserId(), ...payload });
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save todo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (todo: TodoItem) => {
    setSaving(true);
    setError(null);
    try {
      await updateTodo(todo.id, {
        projectId: todo.projectId,
        title: todo.title,
        description: todo.description ?? '',
        cadence: todo.cadence,
        status: todo.status === 'done' ? 'open' : 'done',
        priority: todo.priority,
        dueAt: todo.dueAt,
        sortOrder: todo.sortOrder,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (todo: TodoItem) => {
    setSaving(true);
    setError(null);
    try {
      await updateTodo(todo.id, {
        projectId: todo.projectId,
        title: todo.title,
        description: todo.description ?? '',
        cadence: todo.cadence,
        status: 'archived',
        priority: todo.priority,
        dueAt: todo.dueAt,
        sortOrder: todo.sortOrder,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive todo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (todoId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteTodo(todoId);
      if (editingId === todoId) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">To-do</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Personal tasks, project-linked work, and recurring targets in one place.</p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('/projects')}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
        >
          Open projects
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4 xl:grid-cols-6">
        {[
          statCard('Open', stats.openCount, 'Active work'),
          statCard('Due today', stats.dueTodayCount, 'Needs attention'),
          statCard('Overdue', stats.overdueCount, 'Past due'),
          statCard('Done', stats.doneCount, 'Completed'),
          statCard('Linked', stats.projectLinkedCount, 'Project scoped'),
          statCard('Targets', stats.targetCount, 'Long-horizon'),
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{card.value}</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(12,18,31,0.98))] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{editingId ? 'Edit todo' : 'Quick add'}</div>
            <div className="text-xs text-[var(--color-text-muted)]">Keep it short. Use project links to anchor work.</div>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <input
            value={form.title}
            onChange={(e) => setForm((cur) => ({ ...cur, title: e.target.value }))}
            placeholder="Task title"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-4"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
            placeholder="Description"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-4"
          />
          <select
            value={form.projectId}
            onChange={(e) => setForm((cur) => ({ ...cur, projectId: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-2"
          >
            <option value="none">No project</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={form.cadence}
            onChange={(e) => setForm((cur) => ({ ...cur, cadence: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-1"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="target">Target</option>
          </select>
          <select
            value={form.status}
            onChange={(e) => setForm((cur) => ({ ...cur, status: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-1"
          >
            <option value="open">Open</option>
            <option value="doing">Doing</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={form.priority}
            onChange={(e) => setForm((cur) => ({ ...cur, priority: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-1"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(e) => setForm((cur) => ({ ...cur, dueAt: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none lg:col-span-2"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--color-text-muted)]">Sort order helps keep daily items on top.</div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((cur) => ({ ...cur, sortOrder: Number(e.target.value) || 0 }))}
              className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
            />
            <button
              type="button"
              onClick={submitForm}
              disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              {editingId ? 'Update task' : 'Add task'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, projects, and descriptions"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={15} className="text-[var(--color-text-muted)]" />
          {(['all', 'open', 'doing', 'blocked', 'done', 'archived'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === item ? 'bg-[var(--color-accent)] text-black' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'daily', 'weekly', 'monthly', 'yearly', 'target'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCadenceFilter(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                cadenceFilter === item ? 'bg-[var(--color-accent)] text-black' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
        >
          <option value="all">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">Loading todo items...</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center text-sm text-[var(--color-text-muted)]">
          No todos match the current filters.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-[var(--color-accent)]" />
                  <h2 className="text-sm font-semibold capitalize text-[var(--color-text-primary)]">{group.key}</h2>
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                    {group.items.length}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {group.key === 'target' ? 'Outcome-driven work' : 'Recurring cadence'}
                </div>
              </div>

              <div className="space-y-3">
                {group.items.map((todo) => {
                  const status = STATUS_META[todo.status] ?? STATUS_META.open;
                  const priority = PRIORITY_META[todo.priority] ?? PRIORITY_META.medium;
                  const dueLabel = dueState(todo.dueAt);
                  return (
                    <div key={todo.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-main)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{todo.title}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${status.className}`}>{status.label}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priority.className}`}>{priority.label}</span>
                            {todo.projectName && (
                              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                                <FolderKanban size={11} className="mr-1 inline" />
                                {todo.projectName}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{todo.description || 'No description'}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                            <span className="flex items-center gap-1">
                              <CalendarDays size={12} />
                              {formatDue(todo.dueAt)}
                            </span>
                            {dueLabel && (
                              <span className={`rounded-full px-2 py-0.5 ${todo.status === 'done' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
                                {dueLabel}
                              </span>
                            )}
                            <span>Sort {todo.sortOrder}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(todo.id)}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                          >
                            Edit
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(todo)}
                              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                            >
                              {todo.status === 'done' ? <Circle size={12} className="mr-1 inline" /> : <CheckCircle2 size={12} className="mr-1 inline" />}
                              {todo.status === 'done' ? 'Reopen' : 'Done'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(todo)}
                              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                            >
                              <Archive size={12} className="mr-1 inline" />
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(todo.id)}
                              className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
                            >
                              <Trash2 size={12} className="mr-1 inline" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <Target size={14} className="text-[var(--color-accent)]" />
          Project-linked tasks appear here and can be filtered by project above.
        </div>
        <div className="mt-1">Use `target` for outcome-oriented work, and keep recurring work in the cadence buckets.</div>
      </div>
    </main>
  );
}
