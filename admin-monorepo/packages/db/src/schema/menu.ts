import { sql } from 'drizzle-orm';
import { bigint, char, datetime, int, mysqlTable, primaryKey, varchar } from 'drizzle-orm/mysql-core';

/** 菜单表：M 目录 / C 菜单 / F 动作，F 行的 perms 即后端鉴权点。 */
export const sysMenu = mysqlTable('sys_menu', {
  menuId: bigint('menu_id', { mode: 'number' }).autoincrement().primaryKey(),
  menuName: varchar('menu_name', { length: 50 }).notNull(),
  parentId: bigint('parent_id', { mode: 'number' }).notNull().default(0),
  orderNum: int('order_num').notNull().default(0),
  path: varchar('path', { length: 200 }).notNull().default(''),
  component: varchar('component', { length: 255 }),
  menuType: char('menu_type', { length: 1 }).notNull().default(''),
  status: char('status', { length: 1 }).notNull().default('0'),
  perms: varchar('perms', { length: 100 }),
  icon: varchar('icon', { length: 100 }).notNull().default(''),
  createBy: varchar('create_by', { length: 64 }).notNull().default(''),
  createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updateBy: varchar('update_by', { length: 64 }).notNull().default(''),
  updateTime: datetime('update_time', { mode: 'string' }),
});

/** 岗位直授菜单/动作，对该岗位全部任职人生效，不经角色。 */
export const sysPostMenu = mysqlTable(
  'sys_post_menu',
  {
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    menuId: bigint('menu_id', { mode: 'number' }).notNull(),
    createBy: varchar('create_by', { length: 64 }).notNull().default(''),
    createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.postId, table.menuId] })],
);

/** 组织直授菜单/动作，沿组织树向下继承。 */
export const sysOrgMenu = mysqlTable(
  'sys_org_menu',
  {
    orgId: bigint('org_id', { mode: 'number' }).notNull(),
    menuId: bigint('menu_id', { mode: 'number' }).notNull(),
    createBy: varchar('create_by', { length: 64 }).notNull().default(''),
    createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.menuId] })],
);
