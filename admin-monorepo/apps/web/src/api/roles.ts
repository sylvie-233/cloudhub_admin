import type {
  AssignRoleUsersInput,
  CreateRoleInput,
  RoleDetail,
  RoleListItem,
  RoleQuery,
  RoleUserItem,
  UpdateRoleInput,
} from '@cloudhub/types';

import { request } from './client';

export const roleApi = {
  /** 角色列表（不分页） */
  list(query?: RoleQuery): Promise<RoleListItem[]> {
    return request<RoleListItem[]>('/roles', {
      query: query,
    });
  },

  detail(roleId: number): Promise<RoleDetail> {
    return request<RoleDetail>(`/roles/${roleId}`);
  },

  create(input: CreateRoleInput): Promise<RoleDetail> {
    return request<RoleDetail>('/roles', { method: 'POST', body: input });
  },

  update(roleId: number, input: UpdateRoleInput): Promise<RoleDetail> {
    return request<RoleDetail>(`/roles/${roleId}`, { method: 'PUT', body: input });
  },

  remove(roleId: number): Promise<null> {
    return request<null>(`/roles/${roleId}`, { method: 'DELETE' });
  },

  users(roleId: number): Promise<RoleUserItem[]> {
    return request<RoleUserItem[]>(`/roles/${roleId}/users`);
  },

  /** 整体替换角色成员 */
  assignUsers(roleId: number, input: AssignRoleUsersInput): Promise<RoleUserItem[]> {
    return request<RoleUserItem[]>(`/roles/${roleId}/users`, {
      method: 'PUT',
      body: input,
    });
  },
};
