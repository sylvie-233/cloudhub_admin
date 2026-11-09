import type {
  CreateRoleInput,
  Role,
  RoleDetail,
  RoleListItem,
  RoleQuery,
  RoleUserItem,
  UpdateRoleInput,
} from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import {
  buildRoleListFilter,
  selectRoleById,
  selectRoleKeyConflict,
  selectRoleMenuCount,
  selectRoleUsers,
  selectRoleUsersCount,
  selectRoles,
} from '../sql/role.sql.js';
import type { RoleListRow, RoleRow, RoleUserRow } from '../sql/role.sql.js';
import {
  selectPostPermCountsByUserIds,
  selectUserIdsByIds,
} from '../sql/user.sql.js';
import type { UserCountRow } from '../sql/user.sql.js';
import { HttpError } from '../utils/http.js';
import { loadPostsForUsers } from './user.service.js';

function toRole(row: RoleRow): Role {
  return { ...row };
}

async function findRoleRow(roleId: number): Promise<RoleRow | null> {
  const stmt = selectRoleById(roleId);
  return dbClient.queryOne<RoleRow>(stmt.sql, stmt.params);
}

async function requireRole(roleId: number): Promise<RoleRow> {
  const role = await findRoleRow(roleId);
  if (!role) {
    throw new HttpError(404, '角色不存在或已被删除');
  }
  return role;
}

/** 角色列表（原型为平铺列表，不分页）。 */
export async function listRoles(query: RoleQuery): Promise<RoleListItem[]> {
  const stmt = selectRoles(buildRoleListFilter(query));
  const rows = await dbClient.query<RoleListRow>(stmt.sql, stmt.params);

  return rows.map((row) => ({
    ...toRole(row),
    userCount: Number(row.userCount),
    menuCount: Number(row.menuCount),
  }));
}

async function loadRoleUsers(roleId: number): Promise<RoleUserItem[]> {
  const userStmt = selectRoleUsers(roleId);
  const rows = await dbClient.query<RoleUserRow>(userStmt.sql, userStmt.params);

  if (rows.length === 0) {
    return [];
  }

  const userIds = rows.map((row) => row.userId);
  const countStmt = selectPostPermCountsByUserIds(userIds);
  const [postsMap, countRows] = await Promise.all([
    loadPostsForUsers(userIds),
    dbClient.query<UserCountRow>(countStmt.sql, countStmt.params),
  ]);
  const countMap = new Map(countRows.map((row) => [row.userId, Number(row.total)]));

  return rows.map((row) => ({
    ...row,
    posts: postsMap.get(row.userId) ?? [],
    postPermCount: countMap.get(row.userId) ?? 0,
  }));
}

/** 角色详情（含角色下用户）。 */
export async function getRoleDetail(roleId: number): Promise<RoleDetail> {
  const role = await requireRole(roleId);
  const menuCountStmt = selectRoleMenuCount(roleId);
  const [users, countRow] = await Promise.all([
    loadRoleUsers(roleId),
    dbClient.queryOne<{ menuCount: number }>(menuCountStmt.sql, menuCountStmt.params),
  ]);

  return {
    ...toRole(role),
    userCount: users.length,
    menuCount: Number(countRow?.menuCount ?? 0),
    users,
  };
}

/** 新增角色；权限字符全局唯一（含已删除记录，避免撞唯一索引）。 */
export async function createRole(
  input: CreateRoleInput,
  operator: string,
): Promise<RoleDetail> {
  const dupStmt = selectRoleKeyConflict(input.roleKey);
  const duplicated = await dbClient.queryOne<{ roleId: number }>(
    dupStmt.sql,
    dupStmt.params,
  );
  if (duplicated) {
    throw new HttpError(409, '权限字符已存在');
  }

  const result = await dbClient.execute(
    `INSERT INTO sys_role
      (role_name, role_key, role_sort, data_scope, status, del_flag, create_by, remark)
     VALUES (?, ?, ?, ?, ?, '0', ?, ?)`,
    [
      input.roleName,
      input.roleKey,
      input.roleSort ?? 0,
      input.dataScope ?? '5',
      input.status ?? '0',
      operator,
      input.remark ?? null,
    ],
  );

  return getRoleDetail(result.insertId);
}

/** 修改角色；超级管理员的启用状态与数据范围锁定。 */
export async function updateRole(
  roleId: number,
  input: UpdateRoleInput,
  operator: string,
): Promise<RoleDetail> {
  const current = await requireRole(roleId);

  if (roleId === 1) {
    if (input.dataScope && input.dataScope !== '1') {
      throw new HttpError(400, '超级管理员的角色数据范围锁定为全部数据');
    }
    if (input.status === '1') {
      throw new HttpError(400, '超级管理员角色不可停用');
    }
  }

  const roleKey = input.roleKey ?? current.roleKey;
  if (roleKey !== current.roleKey) {
    const dupStmt = selectRoleKeyConflict(roleKey, roleId);
    const duplicated = await dbClient.queryOne<{ roleId: number }>(
      dupStmt.sql,
      dupStmt.params,
    );
    if (duplicated) {
      throw new HttpError(409, '权限字符已存在');
    }
  }

  await dbClient.execute(
    `UPDATE sys_role
        SET role_name = ?, role_key = ?, role_sort = ?, data_scope = ?, status = ?,
            remark = ?, update_by = ?, update_time = NOW()
      WHERE role_id = ?`,
    [
      input.roleName ?? current.roleName,
      roleKey,
      input.roleSort ?? current.roleSort,
      input.dataScope ?? current.dataScope,
      input.status ?? current.status,
      input.remark === undefined ? current.remark : input.remark,
      operator,
      roleId,
    ],
  );

  return getRoleDetail(roleId);
}

/** 删除角色：内置角色与仍有用户的角色不可删除。 */
export async function deleteRole(roleId: number, operator: string): Promise<void> {
  await requireRole(roleId);

  if (roleId === 1) {
    throw new HttpError(400, '超级管理员角色不可删除');
  }

  const countStmt = selectRoleUsersCount(roleId);
  const count = await dbClient.queryOne<{ total: number }>(
    countStmt.sql,
    countStmt.params,
  );
  if (Number(count?.total ?? 0) > 0) {
    throw new HttpError(400, `该角色下还有 ${Number(count?.total)} 名用户，请先移除后再删除`);
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_role_menu WHERE role_id = ?`, [roleId]);
    await executeOn(conn, `DELETE FROM sys_role_scope_org WHERE role_id = ?`, [roleId]);
    await executeOn(conn, `DELETE FROM sys_user_role WHERE role_id = ?`, [roleId]);
    await executeOn(
      conn,
      `UPDATE sys_role SET del_flag = '2', update_by = ?, update_time = NOW() WHERE role_id = ?`,
      [operator, roleId],
    );
  });
}

/** 角色下的用户列表。 */
export async function listRoleUsers(roleId: number): Promise<RoleUserItem[]> {
  await requireRole(roleId);
  return loadRoleUsers(roleId);
}

/** 重设角色成员：超级管理员角色必须保留内置 admin 用户。 */
export async function assignRoleUsers(
  roleId: number,
  userIds: number[],
  operator: string,
): Promise<RoleUserItem[]> {
  await requireRole(roleId);
  const unique = Array.from(new Set(userIds));

  if (roleId === 1 && !unique.includes(1)) {
    throw new HttpError(400, '超级管理员角色必须保留内置 admin 用户');
  }

  if (unique.length > 0) {
    const stmt = selectUserIdsByIds(unique);
    const rows = await dbClient.query<{ userId: number }>(stmt.sql, stmt.params);
    if (rows.length !== unique.length) {
      throw new HttpError(400, '存在无效的用户，请刷新后重试');
    }
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_user_role WHERE role_id = ?`, [roleId]);
    if (unique.length > 0) {
      await executeOn(
        conn,
        `INSERT INTO sys_user_role (user_id, role_id)
         SELECT user_id, ? FROM sys_user
          WHERE del_flag = '0' AND user_id IN (${placeholders(unique.length)})`,
        [roleId, ...unique],
      );
    }
    await executeOn(
      conn,
      `UPDATE sys_role SET update_by = ?, update_time = NOW() WHERE role_id = ?`,
      [operator, roleId],
    );
  });

  return loadRoleUsers(roleId);
}
