import type { DelFlag, Status } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlStatement } from './shared.js';

export interface PostRow {
  postId: number;
  orgId: number;
  parentId: number;
  postCode: string;
  postName: string;
  postSort: number;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

export interface OrgRefRow {
  orgId: number;
  orgName: string;
  ancestors: string;
  leaderPostId: number | null;
  delFlag: DelFlag;
}

export const POST_COLUMNS = `post_id AS postId, org_id AS orgId, parent_id AS parentId,
  post_code AS postCode, post_name AS postName, post_sort AS postSort,
  status, del_flag AS delFlag, create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

/** 按主键读取岗位。 */
export function selectPostById(postId: number): SqlStatement {
  return {
    sql: `SELECT ${POST_COLUMNS} FROM sys_post WHERE post_id = ? AND del_flag = '0' LIMIT 1`,
    params: [postId],
  };
}

/** 读取岗位所属组织及祖级路径。 */
export function selectOrgRefById(orgId: number): SqlStatement {
  return {
    sql: `SELECT org_id AS orgId, org_name AS orgName, ancestors, leader_post_id AS leaderPostId,
            del_flag AS delFlag
       FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    params: [orgId],
  };
}

/** 某组织的岗位列表。 */
export function selectPostsByOrg(orgId: number): SqlStatement {
  return {
    sql: `SELECT ${POST_COLUMNS} FROM sys_post
      WHERE org_id = ? AND del_flag = '0'
      ORDER BY post_sort, post_id`,
    params: [orgId],
  };
}

/** 某组织各岗位的在岗人数。 */
export function selectPostHeadcountsByOrg(orgId: number): SqlStatement {
  return {
    sql: `SELECT up.post_id AS postId, COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id IN (SELECT post_id FROM sys_post WHERE org_id = ? AND del_flag = '0')
      GROUP BY up.post_id`,
    params: [orgId],
  };
}

/** 单个岗位的在岗人数。 */
export function selectPostHeadcount(postId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id = ?`,
    params: [postId],
  };
}

/** 岗位编码是否已存在；传入 excludePostId 时忽略自身。 */
export function selectPostCodeConflict(
  postCode: string,
  excludePostId?: number,
): SqlStatement {
  return {
    sql: excludePostId
      ? `SELECT post_id AS postId FROM sys_post WHERE post_code = ? AND post_id <> ? LIMIT 1`
      : `SELECT post_id AS postId FROM sys_post WHERE post_code = ? LIMIT 1`,
    params: excludePostId ? [postCode, excludePostId] : [postCode],
  };
}

/** 全部有效岗位的父子关系，用于环路检测。 */
export const postParents: SqlStatement = {
  sql: `SELECT post_id AS postId, parent_id AS parentId FROM sys_post WHERE del_flag = '0'`,
  params: [],
};

/** 岗位在岗人数（删除前校验）。 */
export function selectPostUsersCount(postId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0'
      WHERE up.post_id = ?`,
    params: [postId],
  };
}

/** 批量查询岗位在岗人数（供角色 / 用户模块复用）。 */
export function selectPostHeadcountsByIds(postIds: number[]): SqlStatement {
  return {
    sql: `SELECT up.post_id AS postId, COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id IN (${placeholders(postIds.length)})
      GROUP BY up.post_id`,
    params: postIds,
  };
}
