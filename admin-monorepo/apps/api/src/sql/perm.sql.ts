import type { DataScope } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlStatement } from './shared.js';

export interface PermissionRoleRow {
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
}

export interface PermissionPostRow {
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
}

export interface PermissionOrgRow {
  orgId: number;
  orgName: string;
}

/** 权限管理中读取角色基本信息。 */
export function selectPermissionRole(roleId: number): SqlStatement {
  return {
    sql: `SELECT role_id AS roleId, role_name AS roleName, role_key AS roleKey,
            data_scope AS dataScope
       FROM sys_role WHERE role_id = ? AND del_flag = '0' LIMIT 1`,
    params: [roleId],
  };
}

/** 校验菜单 ID 均存在。 */
export function selectMenuIdsByIds(menuIds: number[]): SqlStatement {
  return {
    sql: `SELECT menu_id AS menuId FROM sys_menu WHERE menu_id IN (${placeholders(menuIds.length)})`,
    params: menuIds,
  };
}

/** 校验组织 ID 均存在且未删除。 */
export function selectOrgIdsByIds(orgIds: number[]): SqlStatement {
  return {
    sql: `SELECT org_id AS orgId FROM sys_org
      WHERE del_flag = '0' AND org_id IN (${placeholders(orgIds.length)})`,
    params: orgIds,
  };
}

/** 岗位直授详情所需的岗位与组织信息。 */
export function selectPermissionPost(postId: number): SqlStatement {
  return {
    sql: `SELECT p.post_id AS postId, p.post_name AS postName, p.org_id AS orgId,
            o.org_name AS orgName
       FROM sys_post p
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE p.post_id = ? AND p.del_flag = '0' LIMIT 1`,
    params: [postId],
  };
}

/** 岗位已授权的菜单 ID。 */
export function selectPostMenuIdsByPostId(postId: number): SqlStatement {
  return {
    sql: `SELECT pm.menu_id AS menuId FROM sys_post_menu pm
       JOIN sys_menu m ON m.menu_id = pm.menu_id
      WHERE pm.post_id = ?
      ORDER BY pm.menu_id`,
    params: [postId],
  };
}

/** 组织直授详情所需的组织信息。 */
export function selectPermissionOrg(orgId: number): SqlStatement {
  return {
    sql: `SELECT org_id AS orgId, org_name AS orgName
       FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    params: [orgId],
  };
}

/** 组织已授权的菜单 ID。 */
export function selectOrgMenuIdsByOrgId(orgId: number): SqlStatement {
  return {
    sql: `SELECT om.menu_id AS menuId FROM sys_org_menu om
       JOIN sys_menu m ON m.menu_id = om.menu_id
      WHERE om.org_id = ?
      ORDER BY om.menu_id`,
    params: [orgId],
  };
}
