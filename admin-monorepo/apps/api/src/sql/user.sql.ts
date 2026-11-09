import type { DataScope, DelFlag, Sex, Status, UserQuery } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlFragment, SqlStatement } from './shared.js';
import { USER_COLUMNS, likePattern } from './shared.js';

export interface UserRow {
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

export interface UserLoginRow {
  userId: number;
  userName: string;
  password: string;
  status: Status;
  delFlag: DelFlag;
}

export interface UserPostRow {
  userId: number;
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
  ancestors: string;
  leaderPostId: number | null;
  postSort: number;
}

export interface UserRoleRow {
  userId: number;
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
}

export interface UserCountRow {
  userId: number;
  total: number;
}

/** 用户列表筛选条件；组织 ID 集合需由调用方先按数据范围裁剪。 */
export interface UserListFilterInput extends Pick<UserQuery, 'keyword' | 'status'> {
  orgFilterIds: number[] | null;
  scopeMode: 'all' | 'orgs' | 'self';
  currentUserId: number;
}

/** 用户列表 WHERE 条件。 */
export function buildUserListFilter(input: UserListFilterInput): SqlFragment {
  const conditions = [`u.del_flag = '0'`];
  const params: unknown[] = [];

  if (input.keyword) {
    conditions.push('(u.user_name LIKE ? OR u.nick_name LIKE ? OR u.phonenumber LIKE ?)');
    const pattern = likePattern(input.keyword);
    params.push(pattern, pattern, pattern);
  }
  if (input.status) {
    conditions.push('u.status = ?');
    params.push(input.status);
  }
  if (input.scopeMode === 'self') {
    conditions.push('u.user_id = ?');
    params.push(input.currentUserId);
  }
  if (input.orgFilterIds) {
    conditions.push(
      `EXISTS (SELECT 1 FROM sys_user_post up
                JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
               WHERE up.user_id = u.user_id
                 AND p.org_id IN (${placeholders(input.orgFilterIds.length)}))`,
    );
    params.push(...input.orgFilterIds);
  }

  return { sql: conditions.join(' AND '), params };
}

/** 用户总数。 */
export function countUsers(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total FROM sys_user u WHERE ${filter.sql}`,
    params: filter.params,
  };
}

/** 用户分页列表。 */
export function selectUsersPage(
  filter: SqlFragment,
  pageSize: number,
  offset: number,
): SqlStatement {
  return {
    sql: `SELECT ${USER_COLUMNS} FROM sys_user u
      WHERE ${filter.sql}
      ORDER BY u.user_id
      LIMIT ? OFFSET ?`,
    params: [...filter.params, pageSize, offset],
  };
}

/** 按主键读取用户。 */
export function selectUserById(userId: number): SqlStatement {
  return {
    sql: `SELECT ${USER_COLUMNS} FROM sys_user u WHERE u.user_id = ? AND u.del_flag = '0' LIMIT 1`,
    params: [userId],
  };
}

/** 登录时按账号读取完整行（含密码哈希）。 */
export function selectUserForLogin(userName: string): SqlStatement {
  return {
    sql: `SELECT user_id AS userId, user_name AS userName, password, status, del_flag AS delFlag
       FROM sys_user WHERE user_name = ? LIMIT 1`,
    params: [userName],
  };
}

/** 账号是否已存在（含已删除记录，避免撞唯一索引）。 */
export function selectUserIdByName(userName: string): SqlStatement {
  return {
    sql: `SELECT user_id AS userId FROM sys_user WHERE user_name = ? LIMIT 1`,
    params: [userName],
  };
}

/** 校验岗位 ID 均存在且未删除。 */
export function selectPostIdsByIds(postIds: number[]): SqlStatement {
  return {
    sql: `SELECT post_id AS postId FROM sys_post
      WHERE del_flag = '0' AND post_id IN (${placeholders(postIds.length)})`,
    params: postIds,
  };
}

/** 校验用户 ID 均存在且未删除。 */
export function selectUserIdsByIds(userIds: number[]): SqlStatement {
  return {
    sql: `SELECT user_id AS userId FROM sys_user
      WHERE del_flag = '0' AND user_id IN (${placeholders(userIds.length)})`,
    params: userIds,
  };
}

/** 校验角色 ID 均存在且未删除。 */
export function selectRoleIdsByIds(roleIds: number[]): SqlStatement {
  return {
    sql: `SELECT role_id AS roleId FROM sys_role
      WHERE del_flag = '0' AND role_id IN (${placeholders(roleIds.length)})`,
    params: roleIds,
  };
}

/** 批量装载用户的任职岗位（含组织路径）；传入 orgIds 时按组织过滤。 */
export function selectPostsByUserIds(
  userIds: number[],
  orgIds?: number[],
): SqlStatement {
  const orgFilter = orgIds
    ? `AND p.org_id IN (${placeholders(orgIds.length)})`
    : '';
  return {
    sql: `SELECT up.user_id AS userId, p.post_id AS postId, p.post_name AS postName,
            p.org_id AS orgId, o.org_name AS orgName, o.ancestors,
            o.leader_post_id AS leaderPostId, p.post_sort AS postSort
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id IN (${placeholders(userIds.length)})
        ${orgFilter}
      ORDER BY p.post_sort, p.post_id`,
    params: orgIds ? [...userIds, ...orgIds] : userIds,
  };
}

/** 登录用户的在岗岗位（仅启用岗位与未删除组织）。 */
export function selectActivePostsByUserId(userId: number): SqlStatement {
  return {
    sql: `SELECT p.post_id AS postId, p.post_name AS postName, p.org_id AS orgId,
            o.org_name AS orgName, o.ancestors, o.leader_post_id AS leaderPostId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0' AND p.status = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?
      ORDER BY p.post_sort, p.post_id`,
    params: [userId],
  };
}

/** 批量装载用户的直接角色。 */
export function selectRolesByUserIds(userIds: number[]): SqlStatement {
  return {
    sql: `SELECT ur.user_id AS userId, r.role_id AS roleId, r.role_name AS roleName,
            r.role_key AS roleKey, r.data_scope AS dataScope
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.del_flag = '0'
      WHERE ur.user_id IN (${placeholders(userIds.length)})
      ORDER BY r.role_sort, r.role_id`,
    params: userIds,
  };
}

/** 用户通过岗位直授获得的菜单数量。 */
export function selectPostPermCountsByUserIds(userIds: number[]): SqlStatement {
  return {
    sql: `SELECT up.user_id AS userId, COUNT(DISTINCT pm.menu_id) AS total
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_post_menu pm ON pm.post_id = up.post_id
      WHERE up.user_id IN (${placeholders(userIds.length)})
      GROUP BY up.user_id`,
    params: userIds,
  };
}

/** 用户通过组织直授（含继承）获得的菜单数量。 */
export function selectOrgPermCountsByUserIds(userIds: number[]): SqlStatement {
  return {
    sql: `SELECT up.user_id AS userId, COUNT(DISTINCT om.menu_id) AS total
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
       JOIN sys_org_menu om ON om.org_id = o.org_id OR FIND_IN_SET(om.org_id, o.ancestors)
      WHERE up.user_id IN (${placeholders(userIds.length)})
      GROUP BY up.user_id`,
    params: userIds,
  };
}

/** 权限来源展示用的岗位名称。 */
export function selectPostNamesByIds(postIds: number[]): SqlStatement {
  return {
    sql: `SELECT post_name AS postName FROM sys_post
      WHERE post_id IN (${placeholders(postIds.length)})
      ORDER BY post_sort, post_id`,
    params: postIds,
  };
}
