import { getCurrentUserId } from '../config/currentUser';
import { createMockProject, getMockProjects } from '../mocks/api/projects';

export interface ProjectResponse {
  id: string;
  requestedByUserId: string | null;
  name: string;
  description: string | null;
  aliases: string[];
  status: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
}

export interface CreateProjectRequest {
  requestedByUserId?: string | null;
  name: string;
  description?: string | null;
  aliases?: string[] | null;
  color?: string | null;
  icon?: string | null;
  isDefault: boolean;
}

export async function getProjects(
  requestedByUserId = getCurrentUserId(),
  limit = 100,
  offset = 0,
): Promise<ProjectResponse[]> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return getMockProjects(requestedByUserId, limit, offset);
  }

  const params = new URLSearchParams({
    requestedByUserId,
    limit: String(limit),
    offset: String(offset),
  });

  const res = await fetch(`/api/projects?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch projects');
  }

  const data = await res.json() as ProjectListResponse;
  return data.projects;
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    const projects = await getMockProjects(getCurrentUserId());
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error('Failed to fetch project');
    }
    return project;
  }

  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch project');
  }

  return res.json() as Promise<ProjectResponse>;
}

export async function createProject(request: CreateProjectRequest): Promise<ProjectResponse> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return createMockProject(request);
  }

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error('Failed to create project');
  }

  return res.json() as Promise<ProjectResponse>;
}
