import type { DataScope, GrantSource, UserMenuNode } from '@cloudhub/types';

import { placeholders } from '@cloudhub/utils';

import { dbClient } from '../db/index.js';

export interface DataScopeResult {
  scope: DataScope;
  mode: 'all' | 'orgs' | 'self';
  orgIds: number[];
}

interface RoleScopeRow {
  roleId: number;
  dataScope: DataScope;
}

interface MenuRow {
  menuId: number;
  menuName: string;
  parentId: number;
  orderNum: number;
  path: string;
  component: string | null;
  menuType: 'M' | 'C';
  status: '0' | '1';
  perms: string | null;
  icon: string;
}

/** 解析用户的数据范围：多角色取最宽的一档，无角色兜底为「仅本人」。 */
export async function resolveDataScope(userId: number): Promise<DataScopeResult> {
  const roles = await dbClient.query<RoleScopeRow>(
    `SELECT r.role_id AS roleId, r.data_scope AS dataScope
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.status = '0' AND r.del_flag = '0'
      WHERE ur.user_id = ?`,
    [userId],
  );

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
    const rows = await dbClient.query<{ orgId: number }>(
      `SELECT DISTINCT rs.org_id AS orgId
         FROM sys_user_role ur
         JOIN sys_role r ON r.role_id = ur.role_id
                        AND r.status = '0' AND r.del_flag = '0' AND r.data_scope = '2'
         JOIN sys_role_scope_org rs ON rs.role_id = r.role_id
        WHERE ur.user_id = ?`,
      [userId],
    );
    return { scope, mode: 'orgs', orgIds: rows.map((row) => row.orgId) };
  }

  const ownOrgs = await dbClient.query<{ orgId: number }>(
    `SELECT DISTINCT p.org_id AS orgId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?`,
    [userId],
  );
  const ownOrgIds = ownOrgs.map((row) => row.orgId);

  if (scope === '3' || ownOrgIds.length === 0) {
    return { scope, mode: 'orgs', orgIds: ownOrgIds };
  }

  // 本组织及以下：本组织 + ancestors 中包含本组织的所有组织
  const descendantConditions = ownOrgIds.map(() => 'FIND_IN_SET(?, ancestors)').join(' OR ');
  const rows = await dbClient.query<{ orgId: number }>(
    `SELECT DISTINCT org_id AS orgId
       FROM sys_org
      WHERE del_flag = '0'
        AND (org_id IN (${placeholders(ownOrgIds.length)}) OR ${descendantConditions})`,
    [...ownOrgIds, ...ownOrgIds],
  );

  return { scope, mode: 'orgs', orgIds: rows.map((row) => row.orgId) };
}

/** 用户最终可访问的菜单/动作 ID（角色 ∪ 岗位 ∪ 组织）。 */
export async function getUserPermissionMenuIds(userId: number): Promise<number[]> {
  const rows = await dbClient.query<{ menuId: number }>(
    `SELECT DISTINCT menu_id AS menuId FROM v_user_permission WHERE user_id = ?`,
    [userId],
  );
  return rows.map((row) => row.menuId);
}

/** 用户最终权限标识集合。 */
export async function getUserPermissionStrings(userId: number): Promise<string[]> {
  const rows = await dbClient.query<{ perms: string | null }>(
    `SELECT DISTINCT perms
       FROM v_user_permission
      WHERE user_id = ? AND perms IS NOT NULL AND perms <> ''`,
    [userId],
  );
  return rows.map((row) => row.perms).filter((perm): perm is string => Boolean(perm));
}

/** 用户可访问的菜单树（仅目录与菜单，动作不参与导航）。 */
export async function getUserMenus(userId: number): Promise<UserMenuNode[]> {
  const rows = await dbClient.query<MenuRow>(
    `SELECT m.menu_id AS menuId, m.menu_name AS menuName, m.parent_id AS parentId,
            m.order_num AS orderNum, m.path, m.component, m.menu_type AS menuType,
            m.status, m.perms, m.icon
       FROM sys_menu m
       JOIN (SELECT DISTINCT menu_id FROM v_user_permission WHERE user_id = ?) vp
         ON vp.menu_id = m.menu_id
      WHERE m.status = '0' AND m.menu_type IN ('M', 'C')
      ORDER BY m.order_num, m.menu_id`,
    [userId],
  );

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
      `SELECT menu_id AS menuId FROM sys_menu ORDER BY menu_id`,
    );
    return rows.map((row) => row.menuId);
  }

  const rows = await dbClient.query<{ menuId: number }>(
    `SELECT rm.menu_id AS menuId
       FROM sys_role_menu rm
       JOIN sys_menu m ON m.menu_id = rm.menu_id
      WHERE rm.role_id = ?
      ORDER BY rm.menu_id`,
    [roleId],
  );
  return rows.map((row) => row.menuId);
}

/** 角色的自定义数据范围组织。 */
export async function getRoleScopeOrgIds(roleId: number): Promise<number[]> {
  const rows = await dbClient.query<{ orgId: number }>(
    `SELECT org_id AS orgId FROM sys_role_scope_org WHERE role_id = ? ORDER BY org_id`,
    [roleId],
  );
  return rows.map((row) => row.orgId);
}

/** 用户权限来源（用于「查看权限」按角色 / 岗位 / 组织拆分）。 */
export async function getPermissionSources(userId: number): Promise<{
  roles: Array<{ roleId: number; roleName: string; roleKey: string; dataScope: DataScope; menuIds: number[] }>;
  postMenuIds: number[];
  postIds: number[];
  orgMenuIds: number[];
}> {
  const roles = await dbClient.query<{
    roleId: number;
    roleName: string;
    roleKey: string;
    dataScope: DataScope;
    menuIds: string | null;
  }>(
    `SELECT r.role_id AS roleId, r.role_name AS roleName, r.role_key AS roleKey,
            r.data_scope AS dataScope,
            GROUP_CONCAT(DISTINCT rm.menu_id) AS menuIds
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.status = '0' AND r.del_flag = '0'
       LEFT JOIN sys_role_menu rm ON rm.role_id = r.role_id
      WHERE ur.user_id = ?
      GROUP BY r.role_id, r.role_name, r.role_key, r.data_scope
      ORDER BY r.role_sort`,
    [userId],
  );

  const roleList = await Promise.all(
    roles.map(async (role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      roleKey: role.roleKey,
      dataScope: role.dataScope,
      menuIds: await getRoleMenuIds(role.roleId),
    })),
  );

  const posts = await dbClient.query<{ postId: number }>(
    `SELECT DISTINCT p.post_id AS postId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
      WHERE up.user_id = ?`,
    [userId],
  );
  const postIds = posts.map((post) => post.postId);

  let postMenuIds: number[] = [];
  if (postIds.length > 0) {
    const rows = await dbClient.query<{ menuId: number }>(
      `SELECT DISTINCT pm.menu_id AS menuId
         FROM sys_post_menu pm
         JOIN sys_menu m ON m.menu_id = pm.menu_id AND m.status = '0'
        WHERE pm.post_id IN (${placeholders(postIds.length)})`,
      postIds,
    );
    postMenuIds = rows.map((row) => row.menuId);
  }

  const orgs = await dbClient.query<{ orgId: number; ancestors: string }>(
    `SELECT DISTINCT p.org_id AS orgId, o.ancestors
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?`,
    [userId],
  );

  const orgMenuSet = new Set<number>();
  for (const org of orgs) {
    const rows = await dbClient.query<{ menuId: number }>(
      `SELECT DISTINCT om.menu_id AS menuId
         FROM sys_org_menu om
         JOIN sys_menu m ON m.menu_id = om.menu_id AND m.status = '0'
        WHERE om.org_id = ? OR FIND_IN_SET(om.org_id, ?)`,
      [org.orgId, org.ancestors],
    );
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
