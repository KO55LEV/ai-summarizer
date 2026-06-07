import type { CreateProjectRequest, ProjectResponse } from '../../api/projects';
import data from '../data/projects.json';
import { delay } from './delay';

let projects: ProjectResponse[] = ((data as { items: ProjectResponse[] }).items ?? []).map((item) => ({ ...item }));

export async function getMockProjects(requestedByUserId?: string, limit = 100, offset = 0): Promise<ProjectResponse[]> {
  await delay();
  const filtered = requestedByUserId ? projects.filter((project) => project.requestedByUserId === requestedByUserId) : projects;
  return filtered.slice(offset, offset + limit);
}

export async function createMockProject(request: CreateProjectRequest): Promise<ProjectResponse> {
  await delay();
  const now = new Date().toISOString();
  const project: ProjectResponse = {
    id: `project-${Date.now()}`,
    requestedByUserId: request.requestedByUserId ?? null,
    name: request.name,
    description: request.description ?? null,
    aliases: request.aliases ?? [],
    status: 'active',
    color: request.color ?? null,
    icon: request.icon ?? null,
    isDefault: request.isDefault,
    createdAt: now,
    updatedAt: now,
  };

  projects = [project, ...projects];
  return project;
}
