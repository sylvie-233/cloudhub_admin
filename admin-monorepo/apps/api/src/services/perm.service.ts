import type {
  DataScope,
  RolePermissionDetail,
  SetDataScopeInput,
  SubjectPermissionDetail,
} from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import { HttpError } from '../utils/http.js';
import { getOrgPathMap } from './org.service.js';
import { getRoleMenuIds, getRoleScopeOrgIds } from './permission.service.js';

interface RoleRow {
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
}

async function requireRole(roleId: number): Promise<RoleRow> {
  const role = await dbClient.queryOne<RoleRow>(
    `SELECT role_id AS roleId, role_name AS roleName, role_key AS roleKey,
            data_scope AS dataScope
       FROM sys_role WHERE role_id = ? AND del_flag = '0' LIMIT 1`,
    [roleId],
  );
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
  const rows = await dbClient.query<{ menuId: number }>(
    `SELECT menu_id AS menuId FROM sys_menu WHERE menu_id IN (${placeholders(unique.length)})`,
    unique,
  );
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
    const rows = await dbClient.query<{ orgId: number }>(
      `SELECT org_id AS orgId FROM sys_org
        WHERE del_flag = '0' AND org_id IN (${placeholders(scopeOrgIds.length)})`,
      scopeOrgIds,
    );
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

async function requirePost(postId: number): Promise<{
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
}> {
  const post = await dbClient.queryOne<{
    postId: number;
    postName: string;
    orgId: number;
    orgName: string;
  }>(
    `SELECT p.post_id AS postId, p.post_name AS postName, p.org_id AS orgId,
            o.org_name AS orgName
       FROM sys_post p
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE p.post_id = ? AND p.del_flag = '0' LIMIT 1`,
    [postId],
  );
  if (!post) {
    throw new HttpError(404, '岗位不存在或已被删除');
  }
  return post;
}

/** 岗位直授权限详情。 */
export async function getPostPermission(postId: number): Promise<SubjectPermissionDetail> {
  const post = await requirePost(postId);
  const rows = await dbClient.query<{ menuId: number }>(
    `SELECT pm.menu_id AS menuId FROM sys_post_menu pm
       JOIN sys_menu m ON m.menu_id = pm.menu_id
      WHERE pm.post_id = ?
      ORDER BY pm.menu_id`,
    [postId],
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

async function requireOrg(orgId: number): Promise<{ orgId: number; orgName: string }> {
  const org = await dbClient.queryOne<{ orgId: number; orgName: string }>(
    `SELECT org_id AS orgId, org_name AS orgName
       FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    [orgId],
  );
  if (!org) {
    throw new HttpError(404, '组织不存在或已被删除');
  }
  return org;
}

/** 组织直授权限详情。 */
export async function getOrgPermission(orgId: number): Promise<SubjectPermissionDetail> {
  const org = await requireOrg(orgId);
  const pathMap = await getOrgPathMap();
  const rows = await dbClient.query<{ menuId: number }>(
    `SELECT om.menu_id AS menuId FROM sys_org_menu om
       JOIN sys_menu m ON m.menu_id = om.menu_id
      WHERE om.org_id = ?
      ORDER BY om.menu_id`,
    [orgId],
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
