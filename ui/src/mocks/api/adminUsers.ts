import type {
  AdminRoleResponse,
  AdminUserResponse,
  UpdateAdminUserInput,
} from '../../api/adminUsers';
import data from '../data/adminUsers.json';
import { delay } from './delay';

type AdminUsersDataFile = {
  users: AdminUserResponse[];
  roles: AdminRoleResponse[];
};

const state = structuredClone(data) as AdminUsersDataFile;

function cloneUser(user: AdminUserResponse): AdminUserResponse {
  return structuredClone(user);
}

function cloneRole(role: AdminRoleResponse): AdminRoleResponse {
  return structuredClone(role);
}

export async function getMockAdminUsers(search = ''): Promise<AdminUserResponse[]> {
  await delay();
  const term = search.trim().toLowerCase();
  if (!term) return state.users.map(cloneUser);

  return state.users
    .filter((user) => [
      user.email,
      user.displayName ?? '',
      user.locale ?? '',
      user.timeZone ?? '',
      user.roles.join(' '),
      user.status,
    ].join(' ').toLowerCase().includes(term))
    .map(cloneUser);
}

export async function getMockAdminUserById(userId: string): Promise<AdminUserResponse> {
  await delay();
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error('User not found');
  return cloneUser(user);
}

export async function getMockAdminRoles(): Promise<AdminRoleResponse[]> {
  await delay();
  return state.roles.map(cloneRole);
}

export async function updateMockAdminUser(userId: string, input: UpdateAdminUserInput): Promise<AdminUserResponse> {
  await delay();
  const index = state.users.findIndex((item) => item.id === userId);
  if (index < 0) throw new Error('User not found');

  const updated: AdminUserResponse = {
    ...state.users[index],
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName?.trim() || null,
    avatarUrl: input.avatarUrl?.trim() || null,
    locale: input.locale?.trim() || null,
    timeZone: input.timeZone?.trim() || null,
    status: input.status.trim().toLowerCase(),
    roles: [...new Set(input.roles.map((role) => role.trim().toLowerCase()).filter(Boolean))].sort(),
    updatedAt: new Date().toISOString(),
  };

  state.users[index] = updated;
  return cloneUser(updated);
}
