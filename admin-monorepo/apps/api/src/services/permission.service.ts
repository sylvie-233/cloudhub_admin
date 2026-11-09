import type { DataScope, GrantSource, Perm, UserMenuNode } from '@cloudhub/types';

import { dbClient } from '../db/index.js';
import {
  allMenuIds,
  selectCustomScopeOrgIds,
  selectOrgMenuIdsForScope,
  selectPermissionMenuIds,
  selectPermissionStrings,
  selectPostMenuIds,
  selectRoleMenuIds,
  selectRolePermissionSources,
  selectRoleScopeOrgIds,
  selectScopeDescendantOrgIds,
  selectUserMenus,
  selectUserOrgScopeRefs,
  selectUserOwnOrgIds,
  selectUserPostIds,
  selectUserRoleScopes,
} from '../sql/permission.sql.js';
import type { MenuNavRow, RoleScopeRow } from '../sql/permission.sql.js';

export interface DataScopeResult {
  scope: DataScope;
  mode: 'all' | 'orgs' | 'self';
  orgIds: number[];
}

/** 解析用户的数据范围：多角色取最宽的一档，无角色兜底为「仅本人」。 */
export async function resolveDataScope(userId: number): Promise<DataScopeResult> {
  const roleStmt = selectUserRoleScopes(userId);
  const roles = await dbClient.query<RoleScopeRow>(roleStmt.sql, roleStmt.params);

  if (roles.length === 0) {
    return { scope: '5', mode: 'self', orgIds: [] };
  }

  const scope = roles
    .map((role) => role.dataScope)
    .sort((a, b) => Number(a) - Number(b))[0] ?? '5';

  if (scope === '1') {
    return { scope, mode: 'all', orgIds: [] };
  }
  if (scope === '5') {
    return { scope, mode: 'self', orgIds: [] };
  }

  if (scope === '2') {
    const stmt = selectCustomScopeOrgIds(userId);
    const rows = await dbClient.query<{ orgId: number }>(stmt.sql, stmt.params);
    return { scope, mode: 'orgs', orgIds: rows.map((row) => row.orgId) };
  }

  const ownStmt = selectUserOwnOrgIds(userId);
  const ownOrgs = await dbClient.query<{ orgId: number }>(ownStmt.sql, ownStmt.params);
  const ownOrgIds = ownOrgs.map((row) => row.orgId);

  if (scope === '3' || ownOrgIds.length === 0) {
    return { scope, mode: 'orgs', orgIds: ownOrgIds };
  }

  // 本组织及以下：本组织 + ancestors 中包含本组织的所有组织
  const descendantStmt = selectScopeDescendantOrgIds(ownOrgIds);
  const rows = await dbClient.query<{ orgId: number }>(
    descendantStmt.sql,
    descendantStmt.params,
  );

  return { scope, mode: 'orgs', orgIds: rows.map((row) => row.orgId) };
}

/** 用户最终可访问的菜单/动作 ID（角色 ∪ 岗位 ∪ 组织）。 */
export async function getUserPermissionMenuIds(userId: number): Promise<number[]> {
  const stmt = selectPermissionMenuIds(userId);
  const rows = await dbClient.query<{ menuId: number }>(stmt.sql, stmt.params);
  return rows.map((row) => row.menuId);
}

/** 用户最终权限标识集合。 */
export async function getUserPermissionStrings(userId: number): Promise<string[]> {
  const stmt = selectPermissionStrings(userId);
  const rows = await dbClient.query<{ perms: string | null }>(stmt.sql, stmt.params);
  return rows.map((row) => row.perms).filter((perm): perm is string => Boolean(perm));
}

/** 判断用户是否拥有指定功能权限（角色 ∪ 岗位 ∪ 组织）。 */
export async function userHasPermission(userId: number, perm: Perm): Promise<boolean> {
  return (await getUserPermissionStrings(userId)).includes(perm);
}

/** 用户可访问的菜单树（仅目录与菜单，动作不参与导航）。 */
export async function getUserMenus(userId: number): Promise<UserMenuNode[]> {
  const menuStmt = selectUserMenus(userId);
  const rows = await dbClient.query<MenuNavRow>(menuStmt.sql, menuStmt.params);

  const nodes = new Map<number, UserMenuNode>();
  for (const row of rows) {
    nodes.set(row.menuId, { ...row, children: [] });
  }

  const roots: UserMenuNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent && parent.menuId !== node.menuId) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: UserMenuNode[]): void => {
    list.sort((a, b) => a.orderNum - b.orderNum || a.menuId - b.menuId);
    list.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

/** 角色已授权的菜单 ID；超级管理员始终返回全部菜单。 */
export async function getRoleMenuIds(roleId: number): Promise<number[]> {
  if (roleId === 1) {
    const rows = await dbClient.query<{ menuId: number }>(
      allMenuIds.sql,
      allMenuIds.params,
    );
    return rows.map((row) => row.menuId);
  }

  const stmt = selectRoleMenuIds(roleId);
  const rows = await dbClient.query<{ menuId: number }>(stmt.sql, stmt.params);
  return rows.map((row) => row.menuId);
}

/** 角色的自定义数据范围组织。 */
export async function getRoleScopeOrgIds(roleId: number): Promise<number[]> {
  const stmt = selectRoleScopeOrgIds(roleId);
  const rows = await dbClient.query<{ orgId: number }>(stmt.sql, stmt.params);
  return rows.map((row) => row.orgId);
}

/** 用户权限来源（用于「查看权限」按角色 / 岗位 / 组织拆分）。 */
export async function getPermissionSources(userId: number): Promise<{
  roles: Array<{ roleId: number; roleName: string; roleKey: string; dataScope: DataScope; menuIds: number[] }>;
  postMenuIds: number[];
  postIds: number[];
  orgMenuIds: number[];
}> {
  const sourcesStmt = selectRolePermissionSources(userId);
  const roles = await dbClient.query<{
    roleId: number;
    roleName: string;
    roleKey: string;
    dataScope: DataScope;
    menuIds: string | null;
  }>(sourcesStmt.sql, sourcesStmt.params);

  const roleList = await Promise.all(
    roles.map(async (role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      roleKey: role.roleKey,
      dataScope: role.dataScope,
      menuIds: await getRoleMenuIds(role.roleId),
    })),
  );

  const postStmt = selectUserPostIds(userId);
  const posts = await dbClient.query<{ postId: number }>(postStmt.sql, postStmt.params);
  const postIds = posts.map((post) => post.postId);

  let postMenuIds: number[] = [];
  if (postIds.length > 0) {
    const stmt = selectPostMenuIds(postIds);
    const rows = await dbClient.query<{ menuId: number }>(stmt.sql, stmt.params);
    postMenuIds = rows.map((row) => row.menuId);
  }

  const orgStmt = selectUserOrgScopeRefs(userId);
  const orgs = await dbClient.query<{ orgId: number; ancestors: string }>(
    orgStmt.sql,
    orgStmt.params,
  );

  const orgMenuSet = new Set<number>();
  for (const org of orgs) {
    const stmt = selectOrgMenuIdsForScope(org.orgId, org.ancestors);
    const rows = await dbClient.query<{ menuId: number }>(stmt.sql, stmt.params);
    rows.forEach((row) => orgMenuSet.add(row.menuId));
  }

  return {
    roles: roleList,
    postMenuIds,
    postIds,
    orgMenuIds: Array.from(orgMenuSet).sort((a, b) => a - b),
  };
}

/** 来源类型的中文说明，供控制器组装响应。 */
export const GRANT_SOURCE_LABELS: Record<GrantSource, string> = {
  user: '角色',
  post: '岗位直授',
  org: '组织直授',
};
