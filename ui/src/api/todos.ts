import { getCurrentUserId } from '../config/currentUser';
import { createMockTodo, deleteMockTodo, getMockTodos, updateMockTodo } from '../mocks/api/todos';
import type { TodoItem, TodoListData } from './types';

export interface CreateTodoRequest {
  requestedByUserId?: string | null;
  projectId?: string | null;
  bucket?: 'today' | 'next' | 'later' | string | null;
  title: string;
  description?: string | null;
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'target' | string;
  status: 'open' | 'doing' | 'blocked' | 'done' | 'archived' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  dueAt?: string | null;
  sortOrder?: number | null;
}

export interface UpdateTodoRequest {
  projectId?: string | null;
  bucket?: 'today' | 'next' | 'later' | string | null;
  title: string;
  description?: string | null;
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'target' | string;
  status: 'open' | 'doing' | 'blocked' | 'done' | 'archived' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  dueAt?: string | null;
  sortOrder: number;
}

export interface GetTodosRequest {
  requestedByUserId?: string;
  projectId?: string;
  bucket?: string;
  cadence?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function getTodos(request: GetTodosRequest = {}): Promise<TodoListData> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockTodos(request);
  }

  const params = new URLSearchParams();
  params.set('requestedByUserId', request.requestedByUserId ?? getCurrentUserId());
  if (request.projectId) params.set('projectId', request.projectId);
  if (request.bucket) params.set('bucket', request.bucket);
  if (request.cadence) params.set('cadence', request.cadence);
  if (request.status) params.set('status', request.status);
  if (request.limit !== undefined) params.set('limit', String(request.limit));
  if (request.offset !== undefined) params.set('offset', String(request.offset));

  const res = await fetch(`/api/todos?${params.toString()}`);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || 'Failed to fetch todos');
  }

  return res.json() as Promise<TodoListData>;
}

export async function getTodo(todoId: string): Promise<TodoItem> {
  const res = await fetch(`/api/todos/${todoId}`);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || 'Failed to fetch todo');
  }

  return res.json() as Promise<TodoItem>;
}

export async function createTodo(request: CreateTodoRequest): Promise<TodoItem> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockTodo(request);
  }

  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || 'Failed to create todo');
  }

  return res.json() as Promise<TodoItem>;
}

export async function updateTodo(todoId: string, request: UpdateTodoRequest): Promise<TodoItem> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return updateMockTodo(todoId, request);
  }

  const res = await fetch(`/api/todos/${todoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || 'Failed to update todo');
  }

  return res.json() as Promise<TodoItem>;
}

export async function deleteTodo(todoId: string): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    await deleteMockTodo(todoId);
    return;
  }

  const res = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || 'Failed to delete todo');
  }
}
