import type { DataScope } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlStatement } from './shared.js';

export interface RoleScopeRow {
  roleId: number;
  dataScope: DataScope;
}

export interface MenuNavRow {
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

export interface RolePermissionSourceRow {
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
  menuIds: string | null;
}

export interface OrgScopeRefRow {
  orgId: number;
  ancestors: string;
}

/** 用户所持角色及其数据范围。 */
export function selectUserRoleScopes(userId: number): SqlStatement {
  return {
    sql: `SELECT r.role_id AS roleId, r.data_scope AS dataScope
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.status = '0' AND r.del_flag = '0'
      WHERE ur.user_id = ?`,
    params: [userId],
  };
}

/** 「自定义」数据范围勾选的组织。 */
export function selectCustomScopeOrgIds(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT rs.org_id AS orgId
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id
                      AND r.status = '0' AND r.del_flag = '0' AND r.data_scope = '2'
       JOIN sys_role_scope_org rs ON rs.role_id = r.role_id
      WHERE ur.user_id = ?`,
    params: [userId],
  };
}

/** 用户岗位所属组织（本组织数据范围）。 */
export function selectUserOwnOrgIds(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT p.org_id AS orgId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?`,
    params: [userId],
  };
}

/** 本组织及以下：本组织 + ancestors 命中本组织的所有组织。 */
export function selectScopeDescendantOrgIds(ownOrgIds: number[]): SqlStatement {
  const descendantConditions = ownOrgIds.map(() => 'FIND_IN_SET(?, ancestors)').join(' OR ');
  return {
    sql: `SELECT DISTINCT org_id AS orgId
       FROM sys_org
      WHERE del_flag = '0'
        AND (org_id IN (${placeholders(ownOrgIds.length)}) OR ${descendantConditions})`,
    params: [...ownOrgIds, ...ownOrgIds],
  };
}

/** 用户最终可访问的菜单 / 动作 ID（角色 ∪ 岗位 ∪ 组织）。 */
export function selectPermissionMenuIds(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT menu_id AS menuId FROM v_user_permission WHERE user_id = ?`,
    params: [userId],
  };
}

/** 用户最终权限标识集合。 */
export function selectPermissionStrings(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT perms
       FROM v_user_permission
      WHERE user_id = ? AND perms IS NOT NULL AND perms <> ''`,
    params: [userId],
  };
}

/** 用户可访问的菜单树（仅目录与菜单，动作不参与导航）。 */
export function selectUserMenus(userId: number): SqlStatement {
  return {
    sql: `SELECT m.menu_id AS menuId, m.menu_name AS menuName, m.parent_id AS parentId,
            m.order_num AS orderNum, m.path, m.component, m.menu_type AS menuType,
            m.status, m.perms, m.icon
       FROM sys_menu m
       JOIN (SELECT DISTINCT menu_id FROM v_user_permission WHERE user_id = ?) vp
         ON vp.menu_id = m.menu_id
      WHERE m.status = '0' AND m.menu_type IN ('M', 'C')
      ORDER BY m.order_num, m.menu_id`,
    params: [userId],
  };
}

/** 全量菜单 ID（超级管理员默认拥有全部权限）。 */
export const allMenuIds: SqlStatement = {
  sql: `SELECT menu_id AS menuId FROM sys_menu ORDER BY menu_id`,
  params: [],
};

/** 角色已授权的菜单 ID。 */
export function selectRoleMenuIds(roleId: number): SqlStatement {
  return {
    sql: `SELECT rm.menu_id AS menuId
       FROM sys_role_menu rm
       JOIN sys_menu m ON m.menu_id = rm.menu_id
      WHERE rm.role_id = ?
      ORDER BY rm.menu_id`,
    params: [roleId],
  };
}

/** 角色的自定义数据范围组织。 */
export function selectRoleScopeOrgIds(roleId: number): SqlStatement {
  return {
    sql: `SELECT org_id AS orgId FROM sys_role_scope_org WHERE role_id = ? ORDER BY org_id`,
    params: [roleId],
  };
}

/** 用户权限来源中的角色列表（含 GROUP_CONCAT 的授权数量）。 */
export function selectRolePermissionSources(userId: number): SqlStatement {
  return {
    sql: `SELECT r.role_id AS roleId, r.role_name AS roleName, r.role_key AS roleKey,
            r.data_scope AS dataScope,
            GROUP_CONCAT(DISTINCT rm.menu_id) AS menuIds
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.status = '0' AND r.del_flag = '0'
       LEFT JOIN sys_role_menu rm ON rm.role_id = r.role_id
      WHERE ur.user_id = ?
      GROUP BY r.role_id, r.role_name, r.role_key, r.data_scope
      ORDER BY r.role_sort`,
    params: [userId],
  };
}

/** 用户的有效岗位 ID。 */
export function selectUserPostIds(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT p.post_id AS postId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
      WHERE up.user_id = ?`,
    params: [userId],
  };
}

/** 岗位直授且启用的菜单 ID。 */
export function selectPostMenuIds(postIds: number[]): SqlStatement {
  return {
    sql: `SELECT DISTINCT pm.menu_id AS menuId
       FROM sys_post_menu pm
       JOIN sys_menu m ON m.menu_id = pm.menu_id AND m.status = '0'
      WHERE pm.post_id IN (${placeholders(postIds.length)})`,
    params: postIds,
  };
}

/** 用户岗位所属组织及其祖级路径。 */
export function selectUserOrgScopeRefs(userId: number): SqlStatement {
  return {
    sql: `SELECT DISTINCT p.org_id AS orgId, o.ancestors
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?`,
    params: [userId],
  };
}

/** 组织直授且启用的菜单 ID（含祖级继承）。 */
export function selectOrgMenuIdsForScope(orgId: number, ancestors: string): SqlStatement {
  return {
    sql: `SELECT DISTINCT om.menu_id AS menuId
       FROM sys_org_menu om
       JOIN sys_menu m ON m.menu_id = om.menu_id AND m.status = '0'
      WHERE om.org_id = ? OR FIND_IN_SET(om.org_id, ?)`,
    params: [orgId, ancestors],
  };
}
