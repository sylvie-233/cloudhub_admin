import type {
  CreateOrgInput,
  DelFlag,
  LoginPost,
  Org,
  OrgDetail,
  OrgQuery,
  OrgTreeNode,
  OrgUserItem,
  PageResult,
  Status,
  UpdateOrgInput,
} from '@cloudhub/types';

import { escapeLike, normalizePagination, paginate, placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import { generateBizCode } from '../utils/code.js';
import { HttpError } from '../utils/http.js';
import { resolveDataScope } from './permission.service.js';

interface OrgRow {
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

interface OrgUserRow {
  userId: number;
  userName: string;
  nickName: string;
  email: string;
  phonenumber: string;
  sex: '0' | '1' | '2';
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

interface UserPostRow {
  userId: number;
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
  ancestors: string;
  leaderPostId: number | null;
  postSort: number;
}

const ORG_COLUMNS = `org_id AS orgId, parent_id AS parentId, ancestors, org_code AS orgCode,
  org_name AS orgName, org_level AS orgLevel, order_num AS orderNum, leader_post_id AS leaderPostId,
  status, del_flag AS delFlag, create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

const USER_COLUMNS = `u.user_id AS userId, u.user_name AS userName, u.nick_name AS nickName,
  u.email, u.phonenumber, u.sex, u.status, u.del_flag AS delFlag,
  u.create_by AS createBy, u.create_time AS createTime,
  u.update_by AS updateBy, u.update_time AS updateTime`;

async function findOrgRow(orgId: number): Promise<OrgRow | null> {
  return dbClient.queryOne<OrgRow>(
    `SELECT ${ORG_COLUMNS} FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    [orgId],
  );
}

async function requireOrg(orgId: number): Promise<OrgRow> {
  const org = await findOrgRow(orgId);
  if (!org) {
    throw new HttpError(404, '组织不存在或已被删除');
  }
  return org;
}

function toOrg(row: OrgRow): Org {
  return { ...row };
}

/** 组织全路径（含自身），如「云枢科技集团 / 深圳总部 / 研发中心」。 */
export async function getOrgPathMap(): Promise<Map<number, string>> {
  const rows = await dbClient.query<{ orgId: number; orgName: string; parentId: number }>(
    `SELECT org_id AS orgId, org_name AS orgName, parent_id AS parentId
       FROM sys_org WHERE del_flag = '0'`,
  );
  const byId = new Map(rows.map((row) => [row.orgId, row]));
  const cache = new Map<number, string>();

  const pathOf = (orgId: number, visiting: Set<number>): string => {
    const cached = cache.get(orgId);
    if (cached) {
      return cached;
    }
    const row = byId.get(orgId);
    if (!row) {
      return '';
    }
    if (visiting.has(orgId)) {
      return row.orgName;
    }
    visiting.add(orgId);
    const parentPath = row.parentId ? pathOf(row.parentId, visiting) : '';
    const path = parentPath ? `${parentPath} / ${row.orgName}` : row.orgName;
    visiting.delete(orgId);
    cache.set(orgId, path);
    return path;
  };

  const result = new Map<number, string>();
  for (const row of rows) {
    result.set(row.orgId, pathOf(row.orgId, new Set<number>()));
  }
  return result;
}

/** 组织自身 + 所有下级组织。 */
export async function getOrgDescendantIds(orgId: number): Promise<number[]> {
  const rows = await dbClient.query<{ orgId: number }>(
    `SELECT org_id AS orgId
       FROM sys_org
      WHERE del_flag = '0' AND (org_id = ? OR FIND_IN_SET(?, ancestors))
      ORDER BY org_level, order_num, org_id`,
    [orgId, orgId],
  );
  return rows.map((row) => row.orgId);
}

/** 组织祖级链（不含自身），根为 0。 */
export async function getOrgAncestorIds(orgId: number): Promise<number[]> {
  const org = await findOrgRow(orgId);
  if (!org) {
    return [];
  }
  return org.ancestors
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

/** 组织树。 */
export async function listOrgTree(query: OrgQuery): Promise<OrgTreeNode[]> {
  const conditions = [`del_flag = '0'`];
  const params: unknown[] = [];

  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  if (query.keyword) {
    conditions.push('(org_name LIKE ? OR org_code LIKE ?)');
    const pattern = `%${escapeLike(query.keyword)}%`;
    params.push(pattern, pattern);
  }

  const rows = await dbClient.query<OrgRow>(
    `SELECT ${ORG_COLUMNS} FROM sys_org
      WHERE ${conditions.join(' AND ')}
      ORDER BY order_num, org_id`,
    params,
  );

  const counts = await dbClient.query<{ orgId: number; postCount: number }>(
    `SELECT org_id AS orgId, COUNT(*) AS postCount
       FROM sys_post
      WHERE del_flag = '0' AND status = '0'
      GROUP BY org_id`,
  );
  const countMap = new Map(counts.map((row) => [row.orgId, Number(row.postCount)]));

  const nodes = new Map<number, OrgTreeNode>();
  for (const row of rows) {
    nodes.set(row.orgId, {
      ...toOrg(row),
      postCount: countMap.get(row.orgId) ?? 0,
      children: [],
    });
  }

  const roots: OrgTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent && parent.orgId !== node.orgId) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: OrgTreeNode[]): void => {
    list.sort((a, b) => a.orderNum - b.orderNum || a.orgId - b.orgId);
    list.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

/** 组织详情：基础信息 + 岗位 + 在岗人数。 */
export async function getOrgDetail(orgId: number): Promise<OrgDetail> {
  const org = await requireOrg(orgId);

  const posts = await dbClient.query<OrgDetail['posts'][number]>(
    `SELECT post_id AS postId, org_id AS orgId, parent_id AS parentId, post_code AS postCode,
            post_name AS postName, post_sort AS postSort, status, del_flag AS delFlag,
            create_by AS createBy, create_time AS createTime,
            update_by AS updateBy, update_time AS updateTime
       FROM sys_post
      WHERE org_id = ? AND del_flag = '0'
      ORDER BY post_sort, post_id`,
    [orgId],
  );

  const count = await dbClient.queryOne<{ headcount: number }>(
    `SELECT COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_post p
       JOIN sys_user_post up ON up.post_id = p.post_id
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE p.org_id = ? AND p.del_flag = '0' AND p.status = '0'`,
    [orgId],
  );

  return { ...toOrg(org), posts, headcount: Number(count?.headcount ?? 0) };
}

/** 新建组织：自动生成编码、默认岗位，并写入 ancestors。 */
export async function createOrg(input: CreateOrgInput, operator: string): Promise<OrgDetail> {
  let parent: OrgRow | null = null;
  if (input.parentId > 0) {
    parent = await requireOrg(input.parentId);
  }

  const orgLevel = parent ? parent.orgLevel + 1 : 1;
  if (orgLevel > 9) {
    throw new HttpError(400, '组织层级最多 9 级，不能再创建下级组织');
  }
  const ancestors = parent ? `${parent.ancestors},${parent.orgId}` : '0';

  const orgCode = input.orgCode?.trim() || (await generateBizCode('org'));
  const duplicated = await dbClient.queryOne<{ orgId: number }>(
    `SELECT org_id AS orgId FROM sys_org WHERE org_code = ? LIMIT 1`,
    [orgCode],
  );
  if (duplicated) {
    throw new HttpError(409, '组织编码已存在');
  }

  const postCode = await generateBizCode('post');

  const orgId = await dbClient.transaction(async (conn) => {
    const orgResult = await executeOn(
      conn,
      `INSERT INTO sys_org
        (parent_id, ancestors, org_code, org_name, org_level, order_num, leader_post_id,
         status, del_flag, create_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, '0', ?)`,
      [
        parent?.orgId ?? 0,
        ancestors,
        orgCode,
        input.orgName,
        orgLevel,
        input.orderNum ?? 0,
        input.status ?? '0',
        operator,
      ],
    );
    const newOrgId = orgResult.insertId;

    // 新组织自动生成默认岗位，并授予基础查询权限（与原型一致）
    const postResult = await executeOn(
      conn,
      `INSERT INTO sys_post
        (org_id, parent_id, post_code, post_name, post_sort, status, del_flag, create_by)
       VALUES (?, 0, ?, '默认岗位', 1, ?, '0', ?)`,
      [newOrgId, postCode, input.status ?? '0', operator],
    );

    await executeOn(
      conn,
      `INSERT IGNORE INTO sys_post_menu (post_id, menu_id, create_by)
       SELECT ?, menu_id, ? FROM sys_menu WHERE menu_id IN (1000, 1001, 10011)`,
      [postResult.insertId, operator],
    );

    return newOrgId;
  });

  return getOrgDetail(orgId);
}

/** 修改组织：支持移动节点，并同步刷新子树的 ancestors / 层级。 */
export async function updateOrg(
  orgId: number,
  input: UpdateOrgInput,
  operator: string,
): Promise<OrgDetail> {
  const current = await requireOrg(orgId);
  const parentId = input.parentId ?? current.parentId;

  let parent: OrgRow | null = null;
  if (parentId > 0) {
    if (parentId === orgId) {
      throw new HttpError(400, '上级组织不能是自己');
    }
    parent = await requireOrg(parentId);
    const parentChain = parent.ancestors.split(',').map((value) => Number(value));
    if (parentChain.includes(orgId)) {
      throw new HttpError(400, '不能把组织移动到自己的下级组织下');
    }
  }

  const orgLevel = parent ? parent.orgLevel + 1 : 1;
  if (orgLevel > 9) {
    throw new HttpError(400, '组织层级最多 9 级');
  }
  const ancestors = parent ? `${parent.ancestors},${parent.orgId}` : '0';

  // 移动后子树最深节点也不能超过 9 级
  const maxRow = await dbClient.queryOne<{ maxLevel: number | null }>(
    `SELECT MAX(org_level) AS maxLevel
       FROM sys_org
      WHERE del_flag = '0' AND FIND_IN_SET(?, ancestors)`,
    [orgId],
  );
  const maxLevel = Number(maxRow?.maxLevel ?? current.orgLevel);
  if (maxLevel + (orgLevel - current.orgLevel) > 9) {
    throw new HttpError(400, '移动后下级组织将超过 9 级，请先调整组织层级');
  }

  const orgCode = input.orgCode ?? current.orgCode;
  if (orgCode !== current.orgCode) {
    const duplicated = await dbClient.queryOne<{ orgId: number }>(
      `SELECT org_id AS orgId FROM sys_org WHERE org_code = ? AND org_id <> ? LIMIT 1`,
      [orgCode, orgId],
    );
    if (duplicated) {
      throw new HttpError(409, '组织编码已存在');
    }
  }

  const sets = [
    'parent_id = ?',
    'ancestors = ?',
    'org_level = ?',
    'org_code = ?',
    'org_name = ?',
    'order_num = ?',
    'status = ?',
    'update_by = ?',
    'update_time = NOW()',
  ];
  const params: unknown[] = [
    parent?.orgId ?? 0,
    ancestors,
    orgLevel,
    orgCode,
    input.orgName ?? current.orgName,
    input.orderNum ?? current.orderNum,
    input.status ?? current.status,
    operator,
    orgId,
  ];

  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `UPDATE sys_org SET ${sets.join(', ')} WHERE org_id = ?`, params);

    const structureChanged =
      parentId !== current.parentId ||
      ancestors !== current.ancestors ||
      orgLevel !== current.orgLevel;
    if (structureChanged) {
      const oldPrefix = `${current.ancestors},${current.orgId}`;
      const newPrefix = `${ancestors},${current.orgId}`;
      await executeOn(
        conn,
        `UPDATE sys_org
            SET ancestors = CONCAT(?, SUBSTRING(ancestors, ?)),
                org_level = org_level + ?
          WHERE del_flag = '0' AND FIND_IN_SET(?, ancestors)`,
        [newPrefix, oldPrefix.length + 1, orgLevel - current.orgLevel, current.orgId],
      );
    }
  });

  return getOrgDetail(orgId);
}

/** 删除组织：存在子组织或岗位时禁止删除，逻辑删除并清理组织授权。 */
export async function deleteOrg(orgId: number, operator: string): Promise<void> {
  await requireOrg(orgId);

  const childCount = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_org WHERE parent_id = ? AND del_flag = '0'`,
    [orgId],
  );
  if (Number(childCount?.total ?? 0) > 0) {
    throw new HttpError(400, '该组织下存在子组织，需先清理后再删除');
  }

  const postCount = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_post WHERE org_id = ? AND del_flag = '0'`,
    [orgId],
  );
  if (Number(postCount?.total ?? 0) > 0) {
    throw new HttpError(400, '该组织下存在岗位，需先清理后再删除');
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_org SET del_flag = '2', update_by = ?, update_time = NOW() WHERE org_id = ?`,
      [operator, orgId],
    );
    await executeOn(conn, `DELETE FROM sys_org_menu WHERE org_id = ?`, [orgId]);
  });
}

/** 设置/清空责任岗位；责任岗位必须属于本组织。 */
export async function setOrgLeader(
  orgId: number,
  postId: number | null,
  operator: string,
): Promise<{ leaderPostId: number | null }> {
  await requireOrg(orgId);

  if (postId !== null) {
    const post = await dbClient.queryOne<{ postId: number; orgId: number; delFlag: string }>(
      `SELECT post_id AS postId, org_id AS orgId, del_flag AS delFlag
         FROM sys_post WHERE post_id = ? LIMIT 1`,
      [postId],
    );
    if (!post || post.delFlag === '2') {
      throw new HttpError(404, '岗位不存在或已被删除');
    }
    if (post.orgId !== orgId) {
      throw new HttpError(400, '责任岗位必须属于当前组织');
    }
  }

  await dbClient.execute(
    `UPDATE sys_org SET leader_post_id = ?, update_by = ?, update_time = NOW() WHERE org_id = ?`,
    [postId, operator, orgId],
  );

  return { leaderPostId: postId };
}

/** 组织在岗用户（支持含下级组织、按岗位筛选），并应用当前用户的数据范围。 */
export async function listOrgUsers(
  orgId: number,
  query: {
    keyword?: string;
    postId?: number;
    includeSub: boolean;
    page?: number;
    pageSize?: number;
  },
  currentUserId: number,
): Promise<PageResult<OrgUserItem>> {
  await requireOrg(orgId);

  const orgIds = query.includeSub ? await getOrgDescendantIds(orgId) : [orgId];
  if (orgIds.length === 0) {
    const { page, pageSize } = normalizePagination(query, 20);
    return paginate([], 0, page, pageSize);
  }

  const scope = await resolveDataScope(currentUserId);
  let scopedOrgIds = orgIds;
  if (scope.mode === 'orgs') {
    const allowed = new Set(scope.orgIds);
    scopedOrgIds = orgIds.filter((id) => allowed.has(id));
    if (scopedOrgIds.length === 0) {
      const { page, pageSize } = normalizePagination(query, 20);
      return paginate([], 0, page, pageSize);
    }
  }

  const conditions = [
    `u.del_flag = '0'`,
    `p.del_flag = '0'`,
    `p.org_id IN (${placeholders(scopedOrgIds.length)})`,
  ];
  const params: unknown[] = [...scopedOrgIds];

  if (query.postId) {
    conditions.push('up.post_id = ?');
    params.push(query.postId);
  }
  if (query.keyword) {
    conditions.push('(u.user_name LIKE ? OR u.nick_name LIKE ? OR u.phonenumber LIKE ?)');
    const pattern = `%${escapeLike(query.keyword)}%`;
    params.push(pattern, pattern, pattern);
  }
  if (scope.mode === 'self') {
    conditions.push('u.user_id = ?');
    params.push(currentUserId);
  }

  const fromSql = `FROM sys_user u
    JOIN sys_user_post up ON up.user_id = u.user_id
    JOIN sys_post p ON p.post_id = up.post_id
   WHERE ${conditions.join(' AND ')}`;

  const { page, pageSize, offset } = normalizePagination(query, 20);

  const countRow = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT u.user_id) AS total ${fromSql}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const rows = await dbClient.query<OrgUserRow>(
    `SELECT DISTINCT ${USER_COLUMNS} ${fromSql}
      ORDER BY u.user_id
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const postsMap = await loadPostsForUsers(
    rows.map((row) => row.userId),
    scopedOrgIds,
  );

  const list: OrgUserItem[] = rows.map((row) => ({
    ...row,
    posts: postsMap.get(row.userId) ?? [],
  }));

  return paginate(list, total, page, pageSize);
}

async function loadPostsForUsers(
  userIds: number[],
  orgIds: number[],
): Promise<Map<number, LoginPost[]>> {
  const result = new Map<number, LoginPost[]>();
  if (userIds.length === 0 || orgIds.length === 0) {
    return result;
  }

  const rows = await dbClient.query<UserPostRow>(
    `SELECT up.user_id AS userId, p.post_id AS postId, p.post_name AS postName,
            p.org_id AS orgId, o.org_name AS orgName, o.ancestors,
            o.leader_post_id AS leaderPostId, p.post_sort AS postSort
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id IN (${placeholders(userIds.length)})
        AND p.org_id IN (${placeholders(orgIds.length)})
      ORDER BY p.post_sort, p.post_id`,
    [...userIds, ...orgIds],
  );

  const pathMap = await getOrgPathMap();

  for (const row of rows) {
    const list = result.get(row.userId) ?? [];
    list.push({
      postId: row.postId,
      postName: row.postName,
      orgId: row.orgId,
      orgName: row.orgName,
      orgPath: pathMap.get(row.orgId) ?? row.orgName,
      isLeader: row.leaderPostId === row.postId,
    });
    result.set(row.userId, list);
  }

  return result;
}
