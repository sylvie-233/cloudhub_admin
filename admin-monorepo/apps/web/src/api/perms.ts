import type {
  RolePermissionDetail,
  SaveMenusInput,
  SetDataScopeInput,
  SubjectPermissionDetail,
} from '@cloudhub/types';

import { request } from './client';

export const permApi = {
  /** 角色权限详情（菜单 + 数据范围） */
  roleDetail(roleId: number): Promise<RolePermissionDetail> {
    return request<RolePermissionDetail>(`/perms/role/${roleId}`);
  },

  /** 保存角色菜单授权 */
  saveRoleMenus(roleId: number, menuIds: number[]): Promise<RolePermissionDetail> {
    const body: SaveMenusInput = { menuIds };
    return request<RolePermissionDetail>(`/perms/role/${roleId}/menus`, {
      method: 'PUT',
      body,
    });
  },

  /** 保存角色数据范围 */
  saveRoleDataScope(roleId: number, input: SetDataScopeInput): Promise<RolePermissionDetail> {
    return request<RolePermissionDetail>(`/perms/role/${roleId}/data-scope`, {
      method: 'PUT',
      body: input,
    });
  },

  /** 岗位直授权限详情 */
  postDetail(postId: number): Promise<SubjectPermissionDetail> {
    return request<SubjectPermissionDetail>(`/perms/post/${postId}`);
  },

  /** 保存岗位直授菜单 */
  savePostMenus(postId: number, menuIds: number[]): Promise<SubjectPermissionDetail> {
    const body: SaveMenusInput = { menuIds };
    return request<SubjectPermissionDetail>(`/perms/post/${postId}/menus`, {
      method: 'PUT',
      body,
    });
  },

  /** 组织直授权限详情（沿组织树向下继承） */
  orgDetail(orgId: number): Promise<SubjectPermissionDetail> {
    return request<SubjectPermissionDetail>(`/perms/org/${orgId}`);
  },

  /** 保存组织直授菜单 */
  saveOrgMenus(orgId: number, menuIds: number[]): Promise<SubjectPermissionDetail> {
    const body: SaveMenusInput = { menuIds };
    return request<SubjectPermissionDetail>(`/perms/org/${orgId}/menus`, {
      method: 'PUT',
      body,
    });
  },
};
