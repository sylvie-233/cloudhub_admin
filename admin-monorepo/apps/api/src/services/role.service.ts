import type {
  CreateRoleInput,
  DataScope,
  DelFlag,
  Role,
  RoleDetail,
  RoleListItem,
  RoleQuery,
  RoleUserItem,
  Status,
  UpdateRoleInput,
} from '@cloudhub/types';
import { escapeLike, placeholders } from '@cloudhub/utils';

import { dbClient, executeOn } from '../db/index.js';
import { HttpError } from '../utils/http.js';
import { loadPostsForUsers } from './user.service.js';

interface RoleRow {
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

interface RoleListRow extends RoleRow {
  userCount: number;
  menuCount: number;
}

interface RoleUserRow {
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

const ROLE_COLUMNS = `r.role_id AS roleId, r.role_name AS roleName, r.role_key AS roleKey,
  r.role_sort AS roleSort, r.data_scope AS dataScope, r.status, r.del_flag AS delFlag,
  r.create_by AS createBy, r.create_time AS createTime,
  r.update_by AS updateBy, r.update_time AS updateTime, r.remark`;

const ROLE_LIST_COLUMNS = `${ROLE_COLUMNS},
  (SELECT COUNT(*) FROM sys_user_role ur
     JOIN sys_user u ON u.user_id = ur.user_id AND u.del_flag = '0'
    WHERE ur.role_id = r.role_id) AS userCount,
  CASE WHEN r.role_id = 1
       THEN (SELECT COUNT(*) FROM sys_menu)
       ELSE (SELECT COUNT(*) FROM sys_role_menu rm WHERE rm.role_id = r.role_id)
  END AS menuCount`;

const USER_COLUMNS = `u.user_id AS userId, u.user_name AS userName, u.nick_name AS nickName,
  u.email, u.phonenumber, u.sex, u.status, u.del_flag AS delFlag,
  u.create_by AS createBy, u.create_time AS createTime,
  u.update_by AS updateBy, u.update_time AS updateTime`;

function toRole(row: RoleRow): Role {
  return { ...row };
}

async function findRoleRow(roleId: number): Promise<RoleRow | null> {
  return dbClient.queryOne<RoleRow>(
    `SELECT ${ROLE_COLUMNS} FROM sys_role r
      WHERE r.role_id = ? AND r.del_flag = '0' LIMIT 1`,
    [roleId],
  );
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
  const conditions = [`r.del_flag = '0'`];
  const params: unknown[] = [];

  if (query.keyword) {
    conditions.push('(r.role_name LIKE ? OR r.role_key LIKE ?)');
    const pattern = `%${escapeLike(query.keyword)}%`;
    params.push(pattern, pattern);
  }
  if (query.status) {
    conditions.push('r.status = ?');
    params.push(query.status);
  }

  const rows = await dbClient.query<RoleListRow>(
    `SELECT ${ROLE_LIST_COLUMNS} FROM sys_role r
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.role_sort, r.role_id`,
    params,
  );

  return rows.map((row) => ({
    ...toRole(row),
    userCount: Number(row.userCount),
    menuCount: Number(row.menuCount),
  }));
}

async function loadRoleUsers(roleId: number): Promise<RoleUserItem[]> {
  const rows = await dbClient.query<RoleUserRow>(
    `SELECT ${USER_COLUMNS}
       FROM sys_user u
       JOIN sys_user_role ur ON ur.user_id = u.user_id
      WHERE ur.role_id = ? AND u.del_flag = '0'
      ORDER BY u.user_id`,
    [roleId],
  );

  if (rows.length === 0) {
    return [];
  }

  const userIds = rows.map((row) => row.userId);
  const [postsMap, countRows] = await Promise.all([
    loadPostsForUsers(userIds),
    dbClient.query<{ userId: number; total: number }>(
      `SELECT up.user_id AS userId, COUNT(DISTINCT pm.menu_id) AS total
         FROM sys_user_post up
         JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0'
         JOIN sys_post_menu pm ON pm.post_id = up.post_id
        WHERE up.user_id IN (${placeholders(userIds.length)})
        GROUP BY up.user_id`,
      userIds,
    ),
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
  const [users, countRow] = await Promise.all([
    loadRoleUsers(roleId),
    dbClient.queryOne<{ menuCount: number }>(
      roleId === 1
        ? `SELECT COUNT(*) AS menuCount FROM sys_menu`
        : `SELECT COUNT(*) AS menuCount FROM sys_role_menu WHERE role_id = ?`,
      roleId === 1 ? [] : [roleId],
    ),
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
  const duplicated = await dbClient.queryOne<{ roleId: number }>(
    `SELECT role_id AS roleId FROM sys_role WHERE role_key = ? LIMIT 1`,
    [input.roleKey],
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
    const duplicated = await dbClient.queryOne<{ roleId: number }>(
      `SELECT role_id AS roleId FROM sys_role WHERE role_key = ? AND role_id <> ? LIMIT 1`,
      [roleKey, roleId],
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

  const count = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM sys_user_role ur
       JOIN sys_user u ON u.user_id = ur.user_id AND u.del_flag = '0'
      WHERE ur.role_id = ?`,
    [roleId],
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
    const rows = await dbClient.query<{ userId: number }>(
      `SELECT user_id AS userId FROM sys_user
        WHERE del_flag = '0' AND user_id IN (${placeholders(unique.length)})`,
      unique,
    );
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
