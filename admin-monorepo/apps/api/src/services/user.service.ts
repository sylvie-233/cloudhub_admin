import type {
  CreateUserInput,
  DataScope,
  DelFlag,
  LoginPost,
  LoginRole,
  PageResult,
  PermissionSource,
  Sex,
  Status,
  UpdateUserInput,
  User,
  UserListItem,
  UserPermissionDetail,
  UserQuery,
} from '@cloudhub/types';
import { DATA_SCOPE_LABELS } from '@cloudhub/types';
import { escapeLike, normalizePagination, paginate, placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import { DEFAULT_PASSWORD, hashPassword } from '../utils/password.js';
import { HttpError } from '../utils/http.js';
import { getOrgDescendantIds, getOrgPathMap } from './org.service.js';
import {
  getPermissionSources,
  getUserPermissionMenuIds,
  resolveDataScope,
} from './permission.service.js';

interface UserRow {
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

interface UserLoginRow {
  userId: number;
  userName: string;
  password: string;
  status: Status;
  delFlag: DelFlag;
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

interface UserRoleRow {
  userId: number;
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
}

const USER_COLUMNS = `u.user_id AS userId, u.user_name AS userName, u.nick_name AS nickName,
  u.email, u.phonenumber, u.sex, u.status, u.del_flag AS delFlag,
  u.create_by AS createBy, u.create_time AS createTime,
  u.update_by AS updateBy, u.update_time AS updateTime`;

async function findUserRow(userId: number): Promise<UserRow | null> {
  return dbClient.queryOne<UserRow>(
    `SELECT ${USER_COLUMNS} FROM sys_user u WHERE u.user_id = ? AND u.del_flag = '0' LIMIT 1`,
    [userId],
  );
}

async function requireUser(userId: number): Promise<UserRow> {
  const user = await findUserRow(userId);
  if (!user) {
    throw new HttpError(404, '用户不存在或已被删除');
  }
  return user;
}

/** 登录时按账号读取完整行（含密码哈希），仅供认证模块使用。 */
export async function findUserForLogin(userName: string): Promise<UserLoginRow | null> {
  return dbClient.queryOne<UserLoginRow>(
    `SELECT user_id AS userId, user_name AS userName, password, status, del_flag AS delFlag
       FROM sys_user WHERE user_name = ? LIMIT 1`,
    [userName],
  );
}

/** 校验岗位 ID 均存在且未删除。 */
async function assertPostsExist(postIds: number[]): Promise<void> {
  const unique = Array.from(new Set(postIds));
  if (unique.length === 0) {
    throw new HttpError(400, '请至少选择一个任职岗位');
  }
  const rows = await dbClient.query<{ postId: number }>(
    `SELECT post_id AS postId FROM sys_post
      WHERE del_flag = '0' AND post_id IN (${placeholders(unique.length)})`,
    unique,
  );
  if (rows.length !== unique.length) {
    throw new HttpError(400, '存在无效的岗位，请刷新后重试');
  }
}

/** 校验角色 ID 均存在且未删除。 */
async function assertRolesExist(roleIds: number[]): Promise<void> {
  const unique = Array.from(new Set(roleIds));
  if (unique.length === 0) {
    return;
  }
  const rows = await dbClient.query<{ roleId: number }>(
    `SELECT role_id AS roleId FROM sys_role
      WHERE del_flag = '0' AND role_id IN (${placeholders(unique.length)})`,
    unique,
  );
  if (rows.length !== unique.length) {
    throw new HttpError(400, '存在无效的角色，请刷新后重试');
  }
}

/** 批量装载用户的任职岗位（含组织路径）。 */
export async function loadPostsForUsers(
  userIds: number[],
): Promise<Map<number, LoginPost[]>> {
  const result = new Map<number, LoginPost[]>();
  if (userIds.length === 0) {
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
      ORDER BY p.post_sort, p.post_id`,
    userIds,
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

export async function loadRolesForUsers(userIds: number[]): Promise<Map<number, LoginRole[]>> {
  const result = new Map<number, LoginRole[]>();
  if (userIds.length === 0) {
    return result;
  }

  const rows = await dbClient.query<UserRoleRow>(
    `SELECT ur.user_id AS userId, r.role_id AS roleId, r.role_name AS roleName,
            r.role_key AS roleKey, r.data_scope AS dataScope
       FROM sys_user_role ur
       JOIN sys_role r ON r.role_id = ur.role_id AND r.del_flag = '0'
      WHERE ur.user_id IN (${placeholders(userIds.length)})
      ORDER BY r.role_sort, r.role_id`,
    userIds,
  );

  for (const row of rows) {
    const list = result.get(row.userId) ?? [];
    list.push({
      roleId: row.roleId,
      roleName: row.roleName,
      roleKey: row.roleKey,
      dataScope: row.dataScope,
    });
    result.set(row.userId, list);
  }

  return result;
}

async function loadPermCounts(
  userIds: number[],
): Promise<{ post: Map<number, number>; org: Map<number, number> }> {
  const post = new Map<number, number>();
  const org = new Map<number, number>();
  if (userIds.length === 0) {
    return { post, org };
  }

  const postRows = await dbClient.query<{ userId: number; total: number }>(
    `SELECT up.user_id AS userId, COUNT(DISTINCT pm.menu_id) AS total
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_post_menu pm ON pm.post_id = up.post_id
      WHERE up.user_id IN (${placeholders(userIds.length)})
      GROUP BY up.user_id`,
    userIds,
  );
  postRows.forEach((row) => post.set(row.userId, Number(row.total)));

  const orgRows = await dbClient.query<{ userId: number; total: number }>(
    `SELECT up.user_id AS userId, COUNT(DISTINCT om.menu_id) AS total
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
       JOIN sys_org_menu om ON om.org_id = o.org_id OR FIND_IN_SET(om.org_id, o.ancestors)
      WHERE up.user_id IN (${placeholders(userIds.length)})
      GROUP BY up.user_id`,
    userIds,
  );
  orgRows.forEach((row) => org.set(row.userId, Number(row.total)));

  return { post, org };
}

async function hydrateUsers(rows: UserRow[]): Promise<UserListItem[]> {
  const userIds = rows.map((row) => row.userId);
  const [postsMap, rolesMap, counts] = await Promise.all([
    loadPostsForUsers(userIds),
    loadRolesForUsers(userIds),
    loadPermCounts(userIds),
  ]);

  return rows.map((row) => ({
    ...row,
    posts: postsMap.get(row.userId) ?? [],
    roles: rolesMap.get(row.userId) ?? [],
    postPermCount: counts.post.get(row.userId) ?? 0,
    orgPermCount: counts.org.get(row.userId) ?? 0,
  }));
}

/** 用户分页列表：按组织子树过滤，并叠加当前用户的数据范围。 */
export async function listUsers(
  query: UserQuery,
  currentUserId: number,
): Promise<PageResult<UserListItem>> {
  const conditions = [`u.del_flag = '0'`];
  const params: unknown[] = [];

  if (query.keyword) {
    conditions.push('(u.user_name LIKE ? OR u.nick_name LIKE ? OR u.phonenumber LIKE ?)');
    const pattern = `%${escapeLike(query.keyword)}%`;
    params.push(pattern, pattern, pattern);
  }
  if (query.status) {
    conditions.push('u.status = ?');
    params.push(query.status);
  }

  let orgFilterIds: number[] | null = null;
  if (query.orgId) {
    orgFilterIds = await getOrgDescendantIds(query.orgId);
  }

  const scope = await resolveDataScope(currentUserId);
  if (scope.mode === 'self') {
    conditions.push('u.user_id = ?');
    params.push(currentUserId);
  } else if (scope.mode === 'orgs') {
    const allowed = new Set(scope.orgIds);
    orgFilterIds = orgFilterIds
      ? orgFilterIds.filter((orgId) => allowed.has(orgId))
      : Array.from(allowed);
  }

  const { page, pageSize, offset } = normalizePagination(query, 10);

  if (orgFilterIds && orgFilterIds.length === 0) {
    return paginate([], 0, page, pageSize);
  }
  if (orgFilterIds) {
    conditions.push(
      `EXISTS (SELECT 1 FROM sys_user_post up
                JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
               WHERE up.user_id = u.user_id
                 AND p.org_id IN (${placeholders(orgFilterIds.length)}))`,
    );
    params.push(...orgFilterIds);
  }

  const whereSql = conditions.join(' AND ');

  const countRow = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_user u WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const rows = await dbClient.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM sys_user u
      WHERE ${whereSql}
      ORDER BY u.user_id
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return paginate(await hydrateUsers(rows), total, page, pageSize);
}

/** 用户详情（含岗位、角色与授权数量）。 */
export async function getUserDetail(userId: number): Promise<UserListItem> {
  const user = await requireUser(userId);
  const [item] = await hydrateUsers([user]);
  if (!item) {
    throw new HttpError(404, '用户不存在或已被删除');
  }
  return item;
}

/** 新增用户：密码缺省为 admin123，同时写入岗位与角色关联。 */
export async function createUser(
  input: CreateUserInput,
  operator: string,
): Promise<UserListItem> {
  const duplicated = await dbClient.queryOne<{ userId: number }>(
    `SELECT user_id AS userId FROM sys_user WHERE user_name = ? LIMIT 1`,
    [input.userName],
  );
  if (duplicated) {
    throw new HttpError(409, '登录账号已存在');
  }

  await assertPostsExist(input.postIds);
  await assertRolesExist(input.roleIds ?? []);

  const password = await hashPassword(input.password ?? DEFAULT_PASSWORD);

  const userId = await dbClient.transaction(async (conn) => {
    const result = await executeOn(
      conn,
      `INSERT INTO sys_user
        (user_name, nick_name, email, phonenumber, sex, password, status, del_flag, create_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, '0', ?)`,
      [
        input.userName,
        input.nickName,
        input.email ?? '',
        input.phonenumber ?? '',
        input.sex ?? '0',
        password,
        input.status ?? '0',
        operator,
      ],
    );
    const newUserId = result.insertId;

    await executeOn(
      conn,
      `INSERT INTO sys_user_post (user_id, post_id)
       SELECT ?, post_id FROM (
         SELECT post_id FROM sys_post
          WHERE del_flag = '0' AND post_id IN (${placeholders(input.postIds.length)})
       ) AS selected`,
      [newUserId, ...Array.from(new Set(input.postIds))],
    );

    const roleIds = Array.from(new Set(input.roleIds ?? []));
    if (roleIds.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_user_role (user_id, role_id)
         SELECT ?, role_id FROM sys_role
          WHERE del_flag = '0' AND role_id IN (${placeholders(roleIds.length)})`,
        [newUserId, ...roleIds],
      );
    }

    return newUserId;
  });

  return getUserDetail(userId);
}

/** 修改用户：岗位与角色传入时整体替换。 */
export async function updateUser(
  userId: number,
  input: UpdateUserInput,
  operator: string,
): Promise<UserListItem> {
  const current = await requireUser(userId);

  if (input.postIds) {
    await assertPostsExist(input.postIds);
  }
  if (input.roleIds) {
    await assertRolesExist(input.roleIds);
  }

  const nickName = input.nickName ?? current.nickName;
  const email = input.email ?? current.email;
  const phonenumber = input.phonenumber ?? current.phonenumber;
  const sex = input.sex ?? current.sex;
  const status = input.status ?? current.status;

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_user
          SET nick_name = ?, email = ?, phonenumber = ?, sex = ?, status = ?,
              update_by = ?, update_time = NOW()
        WHERE user_id = ?`,
      [nickName, email, phonenumber, sex, status, operator, userId],
    );

    if (input.postIds) {
      const postIds = Array.from(new Set(input.postIds));
      await executeOn(conn, `DELETE FROM sys_user_post WHERE user_id = ?`, [userId]);
      await executeOn(
        conn,
        `INSERT INTO sys_user_post (user_id, post_id)
         SELECT ?, post_id FROM sys_post
          WHERE del_flag = '0' AND post_id IN (${placeholders(postIds.length)})`,
        [userId, ...postIds],
      );
    }

    if (input.roleIds) {
      const roleIds = Array.from(new Set(input.roleIds));
      await executeOn(conn, `DELETE FROM sys_user_role WHERE user_id = ?`, [userId]);
      if (roleIds.length > 0) {
        await executeOn(
          conn,
          `INSERT INTO sys_user_role (user_id, role_id)
           SELECT ?, role_id FROM sys_role
            WHERE del_flag = '0' AND role_id IN (${placeholders(roleIds.length)})`,
          [userId, ...roleIds],
        );
      }
    }
  });

  return getUserDetail(userId);
}

/** 删除用户：内置 admin 账号不可删除；逻辑删除并清理关联。 */
export async function deleteUser(userId: number, operator: string): Promise<void> {
  const user = await requireUser(userId);
  if (user.userId === 1 || user.userName === 'admin') {
    throw new HttpError(400, '超级管理员账号不可删除');
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(
      conn,
      `UPDATE sys_user SET del_flag = '2', update_by = ?, update_time = NOW() WHERE user_id = ?`,
      [operator, userId],
    );
    await executeOn(conn, `DELETE FROM sys_user_post WHERE user_id = ?`, [userId]);
    await executeOn(conn, `DELETE FROM sys_user_role WHERE user_id = ?`, [userId]);
  });
}

/** 重置密码；JWT 无状态，旧 token 到期后自然失效。 */
export async function resetUserPassword(
  userId: number,
  password: string,
  operator: string,
): Promise<void> {
  await requireUser(userId);
  const hashed = await hashPassword(password);
  await dbClient.execute(
    `UPDATE sys_user SET password = ?, update_by = ?, update_time = NOW() WHERE user_id = ?`,
    [hashed, operator, userId],
  );
}

/** 重设用户的直接角色。 */
export async function assignUserRoles(
  userId: number,
  roleIds: number[],
  operator: string,
): Promise<UserListItem> {
  await requireUser(userId);
  await assertRolesExist(roleIds);

  const unique = Array.from(new Set(roleIds));
  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_user_role WHERE user_id = ?`, [userId]);
    if (unique.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_user_role (user_id, role_id)
         SELECT ?, role_id FROM sys_role
          WHERE del_flag = '0' AND role_id IN (${placeholders(unique.length)})`,
        [userId, ...unique],
      );
    }
    await executeOn(
      conn,
      `UPDATE sys_user SET update_by = ?, update_time = NOW() WHERE user_id = ?`,
      [operator, userId],
    );
  });

  return getUserDetail(userId);
}

/** 查看用户最终权限与各来源明细。 */
export async function getUserPermissionDetail(
  userId: number,
): Promise<UserPermissionDetail> {
  const user = await requireUser(userId);
  const [menuIds, scope, sources] = await Promise.all([
    getUserPermissionMenuIds(userId),
    resolveDataScope(userId),
    getPermissionSources(userId),
  ]);

  const postNames =
    sources.postIds.length > 0
      ? (
          await dbClient.query<{ postName: string }>(
            `SELECT post_name AS postName FROM sys_post
              WHERE post_id IN (${placeholders(sources.postIds.length)})
              ORDER BY post_sort, post_id`,
            sources.postIds,
          )
        ).map((row) => row.postName)
      : [];

  const sourceList: PermissionSource[] = [
    {
      key: 'all',
      type: 'user',
      sourceId: 0,
      name: '全部权限',
      sub: '角色 ∪ 岗位 ∪ 组织',
      menuIds,
    },
    ...sources.roles.map((role) => ({
      key: `role:${role.roleId}`,
      type: 'user' as const,
      sourceId: role.roleId,
      name: role.roleName,
      sub: `数据范围：${DATA_SCOPE_LABELS[role.dataScope]}`,
      menuIds: role.menuIds,
    })),
  ];

  if (sources.postIds.length > 0) {
    sourceList.push({
      key: 'post',
      type: 'post',
      sourceId: 0,
      name: '岗位直授',
      sub: `覆盖 ${sources.postIds.length} 个岗位：${postNames.join('、')}`,
      menuIds: sources.postMenuIds,
    });
  }
  if (sources.orgMenuIds.length > 0) {
    sourceList.push({
      key: 'org',
      type: 'org',
      sourceId: 0,
      name: '组织直授',
      sub: '沿组织树向下继承',
      menuIds: sources.orgMenuIds,
    });
  }

  return {
    userId: user.userId,
    userName: user.userName,
    nickName: user.nickName,
    menuIds,
    sources: sourceList,
    dataScope: scope.scope,
    dataScopeOrgIds: scope.orgIds,
  };
}

/** 供认证模块复用的用户基础信息。 */
export async function loadUserBase(userId: number): Promise<User | null> {
  const row = await findUserRow(userId);
  return row ? { ...row } : null;
}
