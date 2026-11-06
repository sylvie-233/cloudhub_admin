import { sql } from 'drizzle-orm';
import { bigint, char, datetime, int, mysqlTable, primaryKey, varchar } from 'drizzle-orm/mysql-core';

/** 角色表：数据范围只来源于角色（sys_role.data_scope）。 */
export const sysRole = mysqlTable('sys_role', {
  roleId: bigint('role_id', { mode: 'number' }).autoincrement().primaryKey(),
  roleName: varchar('role_name', { length: 30 }).notNull(),
  roleKey: varchar('role_key', { length: 100 }).notNull(),
  roleSort: int('role_sort').notNull().default(0),
  dataScope: char('data_scope', { length: 1 }).notNull().default('1'),
  status: char('status', { length: 1 }).notNull().default('0'),
  delFlag: char('del_flag', { length: 1 }).notNull().default('0'),
  createBy: varchar('create_by', { length: 64 }).notNull().default(''),
  createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updateBy: varchar('update_by', { length: 64 }).notNull().default(''),
  updateTime: datetime('update_time', { mode: 'string' }),
  remark: varchar('remark', { length: 500 }),
});

/** 用户角色表：角色只授予用户。 */
export const sysUserRole = mysqlTable(
  'sys_user_role',
  {
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    roleId: bigint('role_id', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

/** 角色菜单表。 */
export const sysRoleMenu = mysqlTable(
  'sys_role_menu',
  {
    roleId: bigint('role_id', { mode: 'number' }).notNull(),
    menuId: bigint('menu_id', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.menuId] })],
);

/** 角色自定义数据范围组织（data_scope = '2' 时生效）。 */
export const sysRoleScopeOrg = mysqlTable(
  'sys_role_scope_org',
  {
    roleId: bigint('role_id', { mode: 'number' }).notNull(),
    orgId: bigint('org_id', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.orgId] })],
);
