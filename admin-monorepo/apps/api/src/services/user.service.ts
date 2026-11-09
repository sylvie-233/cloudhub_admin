import type {
  CreateUserInput,
  LoginPost,
  LoginRole,
  PageResult,
  PermissionSource,
  UpdateUserInput,
  User,
  UserListItem,
  UserPermissionDetail,
  UserQuery,
} from '@cloudhub/types';
import { DATA_SCOPE_LABELS } from '@cloudhub/types';
import { normalizePagination, paginate, placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import {
  buildUserListFilter,
  countUsers,
  selectOrgPermCountsByUserIds,
  selectPostIdsByIds,
  selectPostNamesByIds,
  selectPostPermCountsByUserIds,
  selectPostsByUserIds,
  selectRoleIdsByIds,
  selectRolesByUserIds,
  selectUserIdByName,
  selectUserById,
  selectUserForLogin,
  selectUsersPage,
} from '../sql/user.sql.js';
import type {
  UserCountRow,
  UserLoginRow,
  UserPostRow,
  UserRow,
  UserRoleRow,
} from '../sql/user.sql.js';
import { HttpError } from '../utils/http.js';
import { DEFAULT_PASSWORD, hashPassword } from '../utils/password.js';
import { getOrgDescendantIds, getOrgPathMap } from './org.service.js';
import {
  getPermissionSources,
  getUserPermissionMenuIds,
  resolveDataScope,
} from './permission.service.js';

async function findUserRow(userId: number): Promise<UserRow | null> {
  const stmt = selectUserById(userId);
  return dbClient.queryOne<UserRow>(stmt.sql, stmt.params);
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
  const stmt = selectUserForLogin(userName);
  return dbClient.queryOne<UserLoginRow>(stmt.sql, stmt.params);
}

/** 校验岗位 ID 均存在且未删除。 */
async function assertPostsExist(postIds: number[]): Promise<void> {
  const unique = Array.from(new Set(postIds));
  if (unique.length === 0) {
    throw new HttpError(400, '请至少选择一个任职岗位');
  }
  const stmt = selectPostIdsByIds(unique);
  const rows = await dbClient.query<{ postId: number }>(stmt.sql, stmt.params);
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
  const stmt = selectRoleIdsByIds(unique);
  const rows = await dbClient.query<{ roleId: number }>(stmt.sql, stmt.params);
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

  const stmt = selectPostsByUserIds(userIds);
  const rows = await dbClient.query<UserPostRow>(stmt.sql, stmt.params);

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

  const stmt = selectRolesByUserIds(userIds);
  const rows = await dbClient.query<UserRoleRow>(stmt.sql, stmt.params);

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

  const postStmt = selectPostPermCountsByUserIds(userIds);
  const postRows = await dbClient.query<UserCountRow>(postStmt.sql, postStmt.params);
  postRows.forEach((row) => post.set(row.userId, Number(row.total)));

  const orgStmt = selectOrgPermCountsByUserIds(userIds);
  const orgRows = await dbClient.query<UserCountRow>(orgStmt.sql, orgStmt.params);
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
  let orgFilterIds: number[] | null = null;
  if (query.orgId) {
    orgFilterIds = await getOrgDescendantIds(query.orgId);
  }

  const scope = await resolveDataScope(currentUserId);
  if (scope.mode === 'orgs') {
    const allowed = new Set(scope.orgIds);
    orgFilterIds = orgFilterIds
      ? orgFilterIds.filter((orgId) => allowed.has(orgId))
      : Array.from(allowed);
  }

  const { page, pageSize, offset } = normalizePagination(query, 10);

  if (orgFilterIds && orgFilterIds.length === 0) {
    return paginate([], 0, page, pageSize);
  }

  const filter = buildUserListFilter({
    keyword: query.keyword,
    status: query.status,
    orgFilterIds,
    scopeMode: scope.mode,
    currentUserId,
  });

  const countStmt = countUsers(filter);
  const countRow = await dbClient.queryOne<{ total: number }>(
    countStmt.sql,
    countStmt.params,
  );
  const total = Number(countRow?.total ?? 0);

  const pageStmt = selectUsersPage(filter, pageSize, offset);
  const rows = await dbClient.query<UserRow>(pageStmt.sql, pageStmt.params);

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
  const dupStmt = selectUserIdByName(input.userName);
  const duplicated = await dbClient.queryOne<{ userId: number }>(
    dupStmt.sql,
    dupStmt.params,
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

  let postNames: string[] = [];
  if (sources.postIds.length > 0) {
    const stmt = selectPostNamesByIds(sources.postIds);
    const rows = await dbClient.query<{ postName: string }>(stmt.sql, stmt.params);
    postNames = rows.map((row) => row.postName);
  }

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
