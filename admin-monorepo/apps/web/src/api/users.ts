import type {
  AssignRolesInput,
  CreateUserInput,
  PageResult,
  ResetPasswordInput,
  UpdateUserInput,
  UserListItem,
  UserPermissionDetail,
  UserQuery,
} from '@cloudhub/types';

import { request } from './client';

export const userApi = {
  /** 分页查询用户 */
  list(query: UserQuery): Promise<PageResult<UserListItem>> {
    return request<PageResult<UserListItem>>('/users', {
      query: query,
    });
  },

  detail(userId: number): Promise<UserListItem> {
    return request<UserListItem>(`/users/${userId}`);
  },

  create(input: CreateUserInput): Promise<UserListItem> {
    return request<UserListItem>('/users', { method: 'POST', body: input });
  },

  update(userId: number, input: UpdateUserInput): Promise<UserListItem> {
    return request<UserListItem>(`/users/${userId}`, { method: 'PUT', body: input });
  },

  remove(userId: number): Promise<null> {
    return request<null>(`/users/${userId}`, { method: 'DELETE' });
  },

  resetPassword(userId: number, input: ResetPasswordInput): Promise<null> {
    return request<null>(`/users/${userId}/password`, { method: 'PUT', body: input });
  },

  assignRoles(userId: number, input: AssignRolesInput): Promise<UserListItem> {
    return request<UserListItem>(`/users/${userId}/roles`, { method: 'PUT', body: input });
  },

  /** 最终权限与角色 / 岗位 / 组织来源明细 */
  permissions(userId: number): Promise<UserPermissionDetail> {
    return request<UserPermissionDetail>(`/users/${userId}/permissions`);
  },
};
