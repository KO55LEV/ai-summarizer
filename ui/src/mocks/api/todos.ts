import type { CreateTodoRequest, UpdateTodoRequest } from '../../api/todos';
import type { TodoItem, TodoListData } from '../../api/types';
import { getMockProjects } from './projects';
import data from '../data/todos.json';
import { delay } from './delay';

function inferBucket(item: { bucket?: string | null; status?: string | null; dueAt?: string | null }): 'today' | 'next' | 'later' {
  if (item.bucket === 'today' || item.bucket === 'next' || item.bucket === 'later') {
    return item.bucket;
  }

  if (item.status === 'done') {
    return 'today';
  }

  if (item.dueAt) {
    const due = new Date(item.dueAt);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return due.getTime() <= today.getTime() ? 'today' : 'next';
    }
  }

  return 'today';
}

let todos: TodoItem[] = ((data as TodoListData).items ?? []).map((item) => ({
  ...item,
  bucket: inferBucket(item),
}));

function normalize(value?: string | null): string | null {
  return value && value.trim() ? value.trim() : null;
}

function buildStats(items: TodoItem[]): TodoListData['stats'] {
  const todayKey = new Date().toISOString().slice(0, 10);
  return {
    totalCount: items.length,
    openCount: items.filter((item) => item.status === 'open').length,
    doingCount: items.filter((item) => item.status === 'doing').length,
    blockedCount: items.filter((item) => item.status === 'blocked').length,
    doneCount: items.filter((item) => item.status === 'done').length,
    dueTodayCount: items.filter((item) => item.dueAt?.slice(0, 10) === todayKey && item.status !== 'done' && item.status !== 'archived').length,
    overdueCount: items.filter((item) => item.dueAt ? new Date(item.dueAt).getTime() < Date.now() && item.status !== 'done' && item.status !== 'archived' : false).length,
    projectLinkedCount: items.filter((item) => item.projectId).length,
    targetCount: items.filter((item) => item.cadence === 'target').length,
  };
}

async function enrich(items: TodoItem[]): Promise<TodoItem[]> {
  const projects = await getMockProjects();
  return items.map((item) => ({
    ...item,
    projectName: item.projectId ? projects.find((project) => project.id === item.projectId)?.name ?? null : null,
  }));
}

export async function getMockTodos(request: { requestedByUserId?: string; projectId?: string; bucket?: string; cadence?: string; status?: string; limit?: number; offset?: number } = {}): Promise<TodoListData> {
  await delay();
  const filtered = todos.filter((item) => {
    if (request.requestedByUserId && item.requestedByUserId !== request.requestedByUserId) return false;
    if (request.projectId && item.projectId !== request.projectId) return false;
    if (request.bucket && item.bucket !== request.bucket) return false;
    if (request.cadence && item.cadence !== request.cadence) return false;
    if (request.status && item.status !== request.status) return false;
    return true;
  });

  const enriched = await enrich(filtered);
  const offset = request.offset ?? 0;
  const limit = request.limit ?? 100;
  return {
    items: enriched.slice(offset, offset + limit),
    stats: buildStats(enriched),
  };
}

export async function createMockTodo(request: CreateTodoRequest): Promise<TodoItem> {
  await delay();
  const projectName = request.projectId ? (await getMockProjects()).find((project) => project.id === request.projectId)?.name ?? null : null;
  const now = new Date().toISOString();
  const todo: TodoItem = {
    id: `todo-${Date.now()}`,
    requestedByUserId: request.requestedByUserId ?? null,
    projectId: request.projectId ?? null,
    projectName,
    bucket: inferBucket({ bucket: request.bucket, status: request.status, dueAt: request.dueAt }),
    title: request.title,
    description: normalize(request.description),
    cadence: request.cadence,
    status: request.status,
    priority: request.priority,
    dueAt: request.dueAt ?? null,
    completedAt: request.status === 'done' ? now : null,
    sortOrder: request.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  todos = [todo, ...todos];
  return todo;
}

export async function updateMockTodo(todoId: string, request: UpdateTodoRequest): Promise<TodoItem> {
  await delay();
  const index = todos.findIndex((item) => item.id === todoId);
  if (index < 0) {
    throw new Error('Todo not found');
  }

  const projectName = request.projectId ? (await getMockProjects()).find((project) => project.id === request.projectId)?.name ?? null : null;
  const now = new Date().toISOString();
  const completedAt = request.status === 'done' ? (todos[index].completedAt ?? now) : null;
  const next: TodoItem = {
    ...todos[index],
    projectId: request.projectId ?? null,
    projectName,
    bucket: inferBucket({
      ...todos[index],
      bucket: request.bucket ?? todos[index].bucket,
      status: request.status ?? todos[index].status,
      dueAt: request.dueAt ?? todos[index].dueAt,
    }),
    title: request.title,
    description: normalize(request.description),
    cadence: request.cadence,
    status: request.status,
    priority: request.priority,
    dueAt: request.dueAt ?? null,
    completedAt,
    sortOrder: request.sortOrder,
    updatedAt: now,
  };

  todos[index] = next;
  return next;
}

export async function deleteMockTodo(todoId: string): Promise<void> {
  await delay();
  todos = todos.filter((item) => item.id !== todoId);
}
