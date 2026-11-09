import type {
  DataScope,
  DelFlag,
  RoleQuery,
  Sex,
  Status,
} from '@cloudhub/types';

import type { SqlFragment, SqlStatement } from './shared.js';
import { USER_COLUMNS, likePattern } from './shared.js';

export interface RoleRow {
  roleId: number;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope: DataScope;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
  remark: string | null;
}

export interface RoleListRow extends RoleRow {
  userCount: number;
  menuCount: number;
}

export interface RoleUserRow {
  userId: number;
  userName: string;
  nickName: string;
  email: string;
  phonenumber: string;
  sex: Sex;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

export const ROLE_COLUMNS = `r.role_id AS roleId, r.role_name AS roleName, r.role_key AS roleKey,
  r.role_sort AS roleSort, r.data_scope AS dataScope, r.status, r.del_flag AS delFlag,
  r.create_by AS createBy, r.create_time AS createTime,
  r.update_by AS updateBy, r.update_time AS updateTime, r.remark`;

export const ROLE_LIST_COLUMNS = `${ROLE_COLUMNS},
  (SELECT COUNT(*) FROM sys_user_role ur
     JOIN sys_user u ON u.user_id = ur.user_id AND u.del_flag = '0'
    WHERE ur.role_id = r.role_id) AS userCount,
  CASE WHEN r.role_id = 1
       THEN (SELECT COUNT(*) FROM sys_menu)
       ELSE (SELECT COUNT(*) FROM sys_role_menu rm WHERE rm.role_id = r.role_id)
  END AS menuCount`;

/** 按主键读取角色。 */
export function selectRoleById(roleId: number): SqlStatement {
  return {
    sql: `SELECT ${ROLE_COLUMNS} FROM sys_role r
      WHERE r.role_id = ? AND r.del_flag = '0' LIMIT 1`,
    params: [roleId],
  };
}

/** 角色列表筛选条件。 */
export function buildRoleListFilter(query: RoleQuery): SqlFragment {
  const conditions = [`r.del_flag = '0'`];
  const params: unknown[] = [];

  if (query.keyword) {
    conditions.push('(r.role_name LIKE ? OR r.role_key LIKE ?)');
    const pattern = likePattern(query.keyword);
    params.push(pattern, pattern);
  }
  if (query.status) {
    conditions.push('r.status = ?');
    params.push(query.status);
  }

  return { sql: conditions.join(' AND '), params };
}

/** 角色列表（原型为平铺列表，不分页）。 */
export function selectRoles(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT ${ROLE_LIST_COLUMNS} FROM sys_role r
      WHERE ${filter.sql}
      ORDER BY r.role_sort, r.role_id`,
    params: filter.params,
  };
}

/** 角色下的用户。 */
export function selectRoleUsers(roleId: number): SqlStatement {
  return {
    sql: `SELECT ${USER_COLUMNS}
       FROM sys_user u
       JOIN sys_user_role ur ON ur.user_id = u.user_id
      WHERE ur.role_id = ? AND u.del_flag = '0'
      ORDER BY u.user_id`,
    params: [roleId],
  };
}

/** 角色菜单数量；超级管理员按全量菜单计数。 */
export function selectRoleMenuCount(roleId: number): SqlStatement {
  return roleId === 1
    ? { sql: `SELECT COUNT(*) AS menuCount FROM sys_menu`, params: [] }
    : {
        sql: `SELECT COUNT(*) AS menuCount FROM sys_role_menu WHERE role_id = ?`,
        params: [roleId],
      };
}

/** 角色下有效用户数量（删除前校验）。 */
export function selectRoleUsersCount(roleId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total
       FROM sys_user_role ur
       JOIN sys_user u ON u.user_id = ur.user_id AND u.del_flag = '0'
      WHERE ur.role_id = ?`,
    params: [roleId],
  };
}

/** 权限字符是否已存在；含已删除记录，避免撞唯一索引。 */
export function selectRoleKeyConflict(
  roleKey: string,
  excludeRoleId?: number,
): SqlStatement {
  return {
    sql: excludeRoleId
      ? `SELECT role_id AS roleId FROM sys_role WHERE role_key = ? AND role_id <> ? LIMIT 1`
      : `SELECT role_id AS roleId FROM sys_role WHERE role_key = ? LIMIT 1`,
    params: excludeRoleId ? [roleKey, excludeRoleId] : [roleKey],
  };
}
