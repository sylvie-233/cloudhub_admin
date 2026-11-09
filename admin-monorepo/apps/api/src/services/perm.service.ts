import type {
  RolePermissionDetail,
  SetDataScopeInput,
  SubjectPermissionDetail,
} from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import {
  selectMenuIdsByIds,
  selectOrgIdsByIds,
  selectOrgMenuIdsByOrgId,
  selectPermissionOrg,
  selectPermissionPost,
  selectPermissionRole,
  selectPostMenuIdsByPostId,
} from '../sql/perm.sql.js';
import type {
  PermissionOrgRow,
  PermissionPostRow,
  PermissionRoleRow,
} from '../sql/perm.sql.js';
import { HttpError } from '../utils/http.js';
import { getOrgPathMap } from './org.service.js';
import { getRoleMenuIds, getRoleScopeOrgIds } from './permission.service.js';

async function requireRole(roleId: number): Promise<PermissionRoleRow> {
  const stmt = selectPermissionRole(roleId);
  const role = await dbClient.queryOne<PermissionRoleRow>(stmt.sql, stmt.params);
  if (!role) {
    throw new HttpError(404, '角色不存在或已被删除');
  }
  return role;
}

/** 校验菜单 ID 均存在。 */
async function assertMenusExist(menuIds: number[]): Promise<void> {
  const unique = Array.from(new Set(menuIds));
  if (unique.length === 0) {
    return;
  }
  const stmt = selectMenuIdsByIds(unique);
  const rows = await dbClient.query<{ menuId: number }>(stmt.sql, stmt.params);
  if (rows.length !== unique.length) {
    throw new HttpError(400, '存在无效的菜单权限，请刷新后重试');
  }
}

/* ========================= 角色权限 ========================= */

/** 角色权限详情：菜单授权 + 数据范围。 */
export async function getRolePermission(roleId: number): Promise<RolePermissionDetail> {
  const role = await requireRole(roleId);
  const [menuIds, scopeOrgIds] = await Promise.all([
    getRoleMenuIds(roleId),
    getRoleScopeOrgIds(roleId),
  ]);

  return {
    roleId: role.roleId,
    roleName: role.roleName,
    roleKey: role.roleKey,
    locked: roleId === 1,
    menuIds,
    dataScope: role.dataScope,
    scopeOrgIds,
  };
}

/** 保存角色菜单授权；超级管理员锁定。 */
export async function saveRoleMenus(
  roleId: number,
  menuIds: number[],
  operator: string,
): Promise<RolePermissionDetail> {
  await requireRole(roleId);
  if (roleId === 1) {
    throw new HttpError(400, '超级管理员默认拥有全部权限，不可修改');
  }
  await assertMenusExist(menuIds);

  const unique = Array.from(new Set(menuIds));
  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_role_menu WHERE role_id = ?`, [roleId]);
    if (unique.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_role_menu (role_id, menu_id)
         SELECT ?, menu_id FROM sys_menu WHERE menu_id IN (${placeholders(unique.length)})`,
        [roleId, ...unique],
      );
    }
    await executeOn(
      conn,
      `UPDATE sys_role SET update_by = ?, update_time = NOW() WHERE role_id = ?`,
      [operator, roleId],
    );
  });

  return getRolePermission(roleId);
}

/** 设置角色数据范围；自定义范围时同步重建 sys_role_scope_org。 */
export async function setRoleDataScope(
  roleId: number,
  input: SetDataScopeInput,
  operator: string,
): Promise<RolePermissionDetail> {
  await requireRole(roleId);
  if (roleId === 1) {
    throw new HttpError(400, '超级管理员数据范围锁定为全部数据');
  }

  const scopeOrgIds = Array.from(new Set(input.orgIds ?? []));
  if (input.dataScope === '2' && scopeOrgIds.length > 0) {
    const stmt = selectOrgIdsByIds(scopeOrgIds);
    const rows = await dbClient.query<{ orgId: number }>(stmt.sql, stmt.params);
    if (rows.length !== scopeOrgIds.length) {
      throw new HttpError(400, '存在无效的组织，请刷新后重试');
    }
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_role SET data_scope = ?, update_by = ?, update_time = NOW() WHERE role_id = ?`,
      [input.dataScope, operator, roleId],
    );
    await executeOn(conn, `DELETE FROM sys_role_scope_org WHERE role_id = ?`, [roleId]);
    if (input.dataScope === '2' && scopeOrgIds.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_role_scope_org (role_id, org_id)
         SELECT ?, org_id FROM sys_org
          WHERE del_flag = '0' AND org_id IN (${placeholders(scopeOrgIds.length)})`,
        [roleId, ...scopeOrgIds],
      );
    }
  });

  return getRolePermission(roleId);
}

/* ========================= 岗位权限 ========================= */

async function requirePost(postId: number): Promise<PermissionPostRow> {
  const stmt = selectPermissionPost(postId);
  const post = await dbClient.queryOne<PermissionPostRow>(stmt.sql, stmt.params);
  if (!post) {
    throw new HttpError(404, '岗位不存在或已被删除');
  }
  return post;
}

/** 岗位直授权限详情。 */
export async function getPostPermission(postId: number): Promise<SubjectPermissionDetail> {
  const post = await requirePost(postId);
  const menuStmt = selectPostMenuIdsByPostId(postId);
  const rows = await dbClient.query<{ menuId: number }>(
    menuStmt.sql,
    menuStmt.params,
  );

  return {
    type: 'post',
    id: post.postId,
    name: post.postName,
    sub: post.orgName,
    menuIds: rows.map((row) => row.menuId),
  };
}

/** 保存岗位直授菜单。 */
export async function savePostMenus(
  postId: number,
  menuIds: number[],
  operator: string,
): Promise<SubjectPermissionDetail> {
  await requirePost(postId);
  await assertMenusExist(menuIds);

  const unique = Array.from(new Set(menuIds));
  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_post_menu WHERE post_id = ?`, [postId]);
    if (unique.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_post_menu (post_id, menu_id, create_by)
         SELECT ?, menu_id, ? FROM sys_menu WHERE menu_id IN (${placeholders(unique.length)})`,
        [postId, operator, ...unique],
      );
    }
  });

  return getPostPermission(postId);
}

/* ========================= 组织权限 ========================= */

async function requireOrg(orgId: number): Promise<PermissionOrgRow> {
  const stmt = selectPermissionOrg(orgId);
  const org = await dbClient.queryOne<PermissionOrgRow>(stmt.sql, stmt.params);
  if (!org) {
    throw new HttpError(404, '组织不存在或已被删除');
  }
  return org;
}

/** 组织直授权限详情。 */
export async function getOrgPermission(orgId: number): Promise<SubjectPermissionDetail> {
  const org = await requireOrg(orgId);
  const pathMap = await getOrgPathMap();
  const menuStmt = selectOrgMenuIdsByOrgId(orgId);
  const rows = await dbClient.query<{ menuId: number }>(
    menuStmt.sql,
    menuStmt.params,
  );

  return {
    type: 'org',
    id: org.orgId,
    name: org.orgName,
    sub: pathMap.get(org.orgId) ?? org.orgName,
    menuIds: rows.map((row) => row.menuId),
  };
}

/** 保存组织直授菜单（沿组织树向下继承）。 */
export async function saveOrgMenus(
  orgId: number,
  menuIds: number[],
  operator: string,
): Promise<SubjectPermissionDetail> {
  await requireOrg(orgId);
  await assertMenusExist(menuIds);

  const unique = Array.from(new Set(menuIds));
  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_org_menu WHERE org_id = ?`, [orgId]);
    if (unique.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_org_menu (org_id, menu_id, create_by)
         SELECT ?, menu_id, ? FROM sys_menu WHERE menu_id IN (${placeholders(unique.length)})`,
        [orgId, operator, ...unique],
      );
    }
  });

  return getOrgPermission(orgId);
}
