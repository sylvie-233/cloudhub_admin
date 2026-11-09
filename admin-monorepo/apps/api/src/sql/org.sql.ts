import type { DelFlag, OrgQuery, Status } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlFragment, SqlStatement } from './shared.js';
import { USER_COLUMNS, likePattern } from './shared.js';

export interface OrgRow {
  orgId: number;
  parentId: number;
  ancestors: string;
  orgCode: string;
  orgName: string;
  orgLevel: number;
  orderNum: number;
  leaderPostId: number | null;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

export interface OrgPathRow {
  orgId: number;
  orgName: string;
  parentId: number;
}

export interface OrgPostCountRow {
  orgId: number;
  postCount: number;
}

export interface OrgUserFilterInput {
  orgIds: number[];
  postId?: number;
  keyword?: string;
  scopeMode: 'all' | 'orgs' | 'self';
  currentUserId: number;
}

export const ORG_COLUMNS = `org_id AS orgId, parent_id AS parentId, ancestors, org_code AS orgCode,
  org_name AS orgName, org_level AS orgLevel, order_num AS orderNum, leader_post_id AS leaderPostId,
  status, del_flag AS delFlag, create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

/** 按主键读取组织。 */
export function selectOrgById(orgId: number): SqlStatement {
  return {
    sql: `SELECT ${ORG_COLUMNS} FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    params: [orgId],
  };
}

/** 组织路径计算所需的扁平数据。 */
export const orgPathRows: SqlStatement = {
  sql: `SELECT org_id AS orgId, org_name AS orgName, parent_id AS parentId
       FROM sys_org WHERE del_flag = '0'`,
  params: [],
};

/** 组织自身 + 所有下级组织。 */
export function selectOrgDescendantIds(orgId: number): SqlStatement {
  return {
    sql: `SELECT org_id AS orgId
       FROM sys_org
      WHERE del_flag = '0' AND (org_id = ? OR FIND_IN_SET(?, ancestors))
      ORDER BY org_level, order_num, org_id`,
    params: [orgId, orgId],
  };
}

/** 组织树筛选条件。 */
export function buildOrgTreeFilter(
  query: Pick<OrgQuery, 'status' | 'keyword'>,
): SqlFragment {
  const conditions = [`del_flag = '0'`];
  const params: unknown[] = [];

  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  if (query.keyword) {
    conditions.push('(org_name LIKE ? OR org_code LIKE ?)');
    const pattern = likePattern(query.keyword);
    params.push(pattern, pattern);
  }

  return { sql: conditions.join(' AND '), params };
}

/** 组织树行数据。 */
export function selectOrgTree(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT ${ORG_COLUMNS} FROM sys_org
      WHERE ${filter.sql}
      ORDER BY order_num, org_id`,
    params: filter.params,
  };
}

/** 各组织的有效岗位数量。 */
export const orgPostCounts: SqlStatement = {
  sql: `SELECT org_id AS orgId, COUNT(*) AS postCount
       FROM sys_post
      WHERE del_flag = '0' AND status = '0'
      GROUP BY org_id`,
  params: [],
};

/** 组织详情中的岗位列表。 */
export function selectOrgPosts(orgId: number): SqlStatement {
  return {
    sql: `SELECT post_id AS postId, org_id AS orgId, parent_id AS parentId, post_code AS postCode,
            post_name AS postName, post_sort AS postSort, status, del_flag AS delFlag,
            create_by AS createBy, create_time AS createTime,
            update_by AS updateBy, update_time AS updateTime
       FROM sys_post
      WHERE org_id = ? AND del_flag = '0'
      ORDER BY post_sort, post_id`,
    params: [orgId],
  };
}

/** 组织在岗人数（仅启用岗位与正常用户）。 */
export function selectOrgHeadcount(orgId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_post p
       JOIN sys_user_post up ON up.post_id = p.post_id
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE p.org_id = ? AND p.del_flag = '0' AND p.status = '0'`,
    params: [orgId],
  };
}

/** 组织编码是否已存在；传入 excludeOrgId 时忽略自身。 */
export function selectOrgCodeConflict(
  orgCode: string,
  excludeOrgId?: number,
): SqlStatement {
  return {
    sql: excludeOrgId
      ? `SELECT org_id AS orgId FROM sys_org WHERE org_code = ? AND org_id <> ? LIMIT 1`
      : `SELECT org_id AS orgId FROM sys_org WHERE org_code = ? LIMIT 1`,
    params: excludeOrgId ? [orgCode, excludeOrgId] : [orgCode],
  };
}

/** 下级组织中的最大层级，用于移动后的深度校验。 */
export function selectOrgMaxDescendantLevel(orgId: number): SqlStatement {
  return {
    sql: `SELECT MAX(org_level) AS maxLevel
       FROM sys_org
      WHERE del_flag = '0' AND FIND_IN_SET(?, ancestors)`,
    params: [orgId],
  };
}

/** 子组织数量。 */
export function selectOrgChildCount(orgId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total FROM sys_org WHERE parent_id = ? AND del_flag = '0'`,
    params: [orgId],
  };
}

/** 组织下岗位数量。 */
export function selectOrgPostCount(orgId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total FROM sys_post WHERE org_id = ? AND del_flag = '0'`,
    params: [orgId],
  };
}

/** 责任岗位校验：岗位所属组织与删除状态。 */
export function selectOrgLeaderPost(postId: number): SqlStatement {
  return {
    sql: `SELECT post_id AS postId, org_id AS orgId, del_flag AS delFlag
       FROM sys_post WHERE post_id = ? LIMIT 1`,
    params: [postId],
  };
}

/** 组织在岗用户查询的 FROM / WHERE 片段。 */
export function buildOrgUserFilter(input: OrgUserFilterInput): SqlFragment {
  const conditions = [
    `u.del_flag = '0'`,
    `p.del_flag = '0'`,
    `p.org_id IN (${placeholders(input.orgIds.length)})`,
  ];
  const params: unknown[] = [...input.orgIds];

  if (input.postId) {
    conditions.push('up.post_id = ?');
    params.push(input.postId);
  }
  if (input.keyword) {
    conditions.push('(u.user_name LIKE ? OR u.nick_name LIKE ? OR u.phonenumber LIKE ?)');
    const pattern = likePattern(input.keyword);
    params.push(pattern, pattern, pattern);
  }
  if (input.scopeMode === 'self') {
    conditions.push('u.user_id = ?');
    params.push(input.currentUserId);
  }

  return {
    sql: `FROM sys_user u
    JOIN sys_user_post up ON up.user_id = u.user_id
    JOIN sys_post p ON p.post_id = up.post_id
   WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

/** 组织在岗用户总数。 */
export function countOrgUsers(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT COUNT(DISTINCT u.user_id) AS total ${filter.sql}`,
    params: filter.params,
  };
}

/** 组织在岗用户分页。 */
export function selectOrgUsersPage(
  filter: SqlFragment,
  pageSize: number,
  offset: number,
): SqlStatement {
  return {
    sql: `SELECT DISTINCT ${USER_COLUMNS} ${filter.sql}
      ORDER BY u.user_id
      LIMIT ? OFFSET ?`,
    params: [...filter.params, pageSize, offset],
  };
}
