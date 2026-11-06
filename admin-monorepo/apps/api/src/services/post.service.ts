import type {
  CreatePostInput,
  DelFlag,
  PostDetail,
  PostTreeNode,
  Status,
  UpdatePostInput,
} from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import { generateBizCode } from '../utils/code.js';
import { HttpError } from '../utils/http.js';
import { getOrgPathMap } from './org.service.js';

interface PostRow {
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

interface OrgRow {
  orgId: number;
  orgName: string;
  ancestors: string;
  leaderPostId: number | null;
  delFlag: DelFlag;
}

const POST_COLUMNS = `post_id AS postId, org_id AS orgId, parent_id AS parentId,
  post_code AS postCode, post_name AS postName, post_sort AS postSort,
  status, del_flag AS delFlag, create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

async function findPostRow(postId: number): Promise<PostRow | null> {
  return dbClient.queryOne<PostRow>(
    `SELECT ${POST_COLUMNS} FROM sys_post WHERE post_id = ? AND del_flag = '0' LIMIT 1`,
    [postId],
  );
}

async function requirePost(postId: number): Promise<PostRow> {
  const post = await findPostRow(postId);
  if (!post) {
    throw new HttpError(404, '岗位不存在或已被删除');
  }
  return post;
}

async function requireOrg(orgId: number): Promise<OrgRow> {
  const org = await dbClient.queryOne<OrgRow>(
    `SELECT org_id AS orgId, org_name AS orgName, ancestors, leader_post_id AS leaderPostId,
            del_flag AS delFlag
       FROM sys_org WHERE org_id = ? AND del_flag = '0' LIMIT 1`,
    [orgId],
  );
  if (!org) {
    throw new HttpError(404, '组织不存在或已被删除');
  }
  return org;
}

/** 某组织的岗位树（上级岗位不在本组织时视为根节点）。 */
export async function listPostsByOrg(orgId: number): Promise<PostTreeNode[]> {
  const org = await requireOrg(orgId);

  const rows = await dbClient.query<PostRow>(
    `SELECT ${POST_COLUMNS} FROM sys_post
      WHERE org_id = ? AND del_flag = '0'
      ORDER BY post_sort, post_id`,
    [orgId],
  );

  const counts = await dbClient.query<{ postId: number; headcount: number }>(
    `SELECT up.post_id AS postId, COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id IN (SELECT post_id FROM sys_post WHERE org_id = ? AND del_flag = '0')
      GROUP BY up.post_id`,
    [orgId],
  );
  const countMap = new Map(counts.map((row) => [row.postId, Number(row.headcount)]));

  const nodes = new Map<number, PostTreeNode>();
  for (const row of rows) {
    nodes.set(row.postId, {
      ...row,
      headcount: countMap.get(row.postId) ?? 0,
      isLeader: org.leaderPostId === row.postId,
      children: [],
    });
  }

  const roots: PostTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent && parent.postId !== node.postId) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const visited = new Set<number>();
  const sortNodes = (list: PostTreeNode[]): void => {
    list.sort((a, b) => a.postSort - b.postSort || a.postId - b.postId);
    for (const node of list) {
      if (visited.has(node.postId)) {
        continue;
      }
      visited.add(node.postId);
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

/** 岗位详情。 */
export async function getPostDetail(postId: number): Promise<PostDetail> {
  const post = await requirePost(postId);
  const org = await requireOrg(post.orgId);
  const pathMap = await getOrgPathMap();

  const count = await dbClient.queryOne<{ headcount: number }>(
    `SELECT COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id = ?`,
    [postId],
  );

  const ancestorIds = org.ancestors
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return {
    ...post,
    orgName: org.orgName,
    orgPath: pathMap.get(org.orgId) ?? org.orgName,
    ancestorIds,
    headcount: Number(count?.headcount ?? 0),
    isLeader: org.leaderPostId === postId,
  };
}

/** 新增岗位；isLeader 为 true 时同步设置责任岗位。 */
export async function createPost(
  input: CreatePostInput,
  operator: string,
): Promise<PostDetail> {
  const org = await requireOrg(input.orgId);
  const parentId = input.parentId ?? 0;

  if (parentId > 0) {
    const parent = await findPostRow(parentId);
    if (!parent) {
      throw new HttpError(400, '上级岗位不存在或已被删除');
    }
  }

  const postCode = input.postCode?.trim() || (await generateBizCode('post'));
  const duplicated = await dbClient.queryOne<{ postId: number }>(
    `SELECT post_id AS postId FROM sys_post WHERE post_code = ? LIMIT 1`,
    [postCode],
  );
  if (duplicated) {
    throw new HttpError(409, '岗位编码已存在');
  }

  const postId = await dbClient.transaction(async (conn) => {
    const result = await executeOn(
      conn,
      `INSERT INTO sys_post
        (org_id, parent_id, post_code, post_name, post_sort, status, del_flag, create_by)
       VALUES (?, ?, ?, ?, ?, ?, '0', ?)`,
      [
        org.orgId,
        parentId,
        postCode,
        input.postName,
        input.postSort ?? 0,
        input.status ?? '0',
        operator,
      ],
    );

    if (input.isLeader) {
      await executeOn(
        conn,
        `UPDATE sys_org SET leader_post_id = ?, update_by = ?, update_time = NOW()
          WHERE org_id = ?`,
        [result.insertId, operator, org.orgId],
      );
    }

    return result.insertId;
  });

  return getPostDetail(postId);
}

/** 修改岗位：支持调整组织与上级岗位，责任岗位变更同步到组织。 */
export async function updatePost(
  postId: number,
  input: UpdatePostInput,
  operator: string,
): Promise<PostDetail> {
  const current = await requirePost(postId);
  const orgId = input.orgId ?? current.orgId;
  const org = await requireOrg(orgId);
  const parentId = input.parentId ?? current.parentId;

  if (parentId > 0) {
    if (parentId === postId) {
      throw new HttpError(400, '上级岗位不能是自己');
    }
    const parent = await findPostRow(parentId);
    if (!parent) {
      throw new HttpError(400, '上级岗位不存在或已被删除');
    }
    const allPosts = await dbClient.query<{ postId: number; parentId: number }>(
      `SELECT post_id AS postId, parent_id AS parentId FROM sys_post WHERE del_flag = '0'`,
    );
    const parentMap = new Map(allPosts.map((post) => [post.postId, post.parentId]));
    let cursor: number | undefined = parentId;
    const visited = new Set<number>();
    while (cursor && cursor > 0) {
      if (cursor === postId) {
        throw new HttpError(400, '不能把岗位移动到自己的下级岗位下');
      }
      if (visited.has(cursor)) {
        break;
      }
      visited.add(cursor);
      cursor = parentMap.get(cursor);
    }
  }

  const postCode = input.postCode ?? current.postCode;
  if (postCode !== current.postCode) {
    const duplicated = await dbClient.queryOne<{ postId: number }>(
      `SELECT post_id AS postId FROM sys_post WHERE post_code = ? AND post_id <> ? LIMIT 1`,
      [postCode, postId],
    );
    if (duplicated) {
      throw new HttpError(409, '岗位编码已存在');
    }
  }

  const postName = input.postName ?? current.postName;
  const postSort = input.postSort ?? current.postSort;
  const status = input.status ?? current.status;

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_post
          SET org_id = ?, parent_id = ?, post_code = ?, post_name = ?, post_sort = ?,
              status = ?, update_by = ?, update_time = NOW()
        WHERE post_id = ?`,
      [orgId, parentId, postCode, postName, postSort, status, operator, postId],
    );

    if (orgId !== current.orgId) {
      await executeOn(
        conn,
        `UPDATE sys_org SET leader_post_id = NULL, update_by = ?, update_time = NOW()
          WHERE org_id = ? AND leader_post_id = ?`,
        [operator, current.orgId, postId],
      );
    }

    if (input.isLeader === true) {
      await executeOn(
        conn,
        `UPDATE sys_org SET leader_post_id = ?, update_by = ?, update_time = NOW()
          WHERE org_id = ?`,
        [postId, operator, org.orgId],
      );
    } else if (input.isLeader === false) {
      await executeOn(
        conn,
        `UPDATE sys_org SET leader_post_id = NULL, update_by = ?, update_time = NOW()
          WHERE org_id = ? AND leader_post_id = ?`,
        [operator, org.orgId, postId],
      );
    }
  });

  return getPostDetail(postId);
}

/** 删除岗位：仍有在岗人员时禁止；删除后清理授权与子岗位挂接。 */
export async function deletePost(postId: number, operator: string): Promise<void> {
  await requirePost(postId);

  const count = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0'
      WHERE up.post_id = ?`,
    [postId],
  );
  if (Number(count?.total ?? 0) > 0) {
    throw new HttpError(400, `该岗位仍有 ${Number(count?.total)} 人在岗，需先调岗后再删除`);
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_org SET leader_post_id = NULL, update_by = ?, update_time = NOW()
        WHERE leader_post_id = ?`,
      [operator, postId],
    );
    await executeOn(conn, `UPDATE sys_post SET parent_id = 0 WHERE parent_id = ?`, [postId]);
    await executeOn(conn, `DELETE FROM sys_post_menu WHERE post_id = ?`, [postId]);
    await executeOn(conn, `DELETE FROM sys_user_post WHERE post_id = ?`, [postId]);
    await executeOn(
      conn,
      `UPDATE sys_post SET del_flag = '2', update_by = ?, update_time = NOW() WHERE post_id = ?`,
      [operator, postId],
    );
  });
}

/** 批量查询岗位在岗人数（供角色/用户模块复用）。 */
export async function countPostsHeadcount(postIds: number[]): Promise<Map<number, number>> {
  if (postIds.length === 0) {
    return new Map();
  }
  const rows = await dbClient.query<{ postId: number; headcount: number }>(
    `SELECT up.post_id AS postId, COUNT(DISTINCT u.user_id) AS headcount
       FROM sys_user_post up
       JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
      WHERE up.post_id IN (${placeholders(postIds.length)})
      GROUP BY up.post_id`,
    postIds,
  );
  return new Map(rows.map((row) => [row.postId, Number(row.headcount)]));
}
