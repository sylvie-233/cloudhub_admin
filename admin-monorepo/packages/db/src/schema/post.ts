import { sql } from 'drizzle-orm';
import { bigint, char, datetime, int, mysqlTable, primaryKey, varchar } from 'drizzle-orm/mysql-core';

/** 岗位表：挂在组织下，通过 parent_id 形成可跨组织的汇报线。 */
export const sysPost = mysqlTable('sys_post', {
  postId: bigint('post_id', { mode: 'number' }).autoincrement().primaryKey(),
  orgId: bigint('org_id', { mode: 'number' }).notNull(),
  parentId: bigint('parent_id', { mode: 'number' }).notNull().default(0),
  postCode: varchar('post_code', { length: 64 }).notNull(),
  postName: varchar('post_name', { length: 64 }).notNull(),
  postSort: int('post_sort').notNull().default(0),
  status: char('status', { length: 1 }).notNull().default('0'),
  delFlag: char('del_flag', { length: 1 }).notNull().default('0'),
  createBy: varchar('create_by', { length: 64 }).notNull().default(''),
  createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updateBy: varchar('update_by', { length: 64 }).notNull().default(''),
  updateTime: datetime('update_time', { mode: 'string' }),
});

/** 用户与岗位多对多关联：用户不直接绑定组织，组织归属由岗位推导。 */
export const sysUserPost = mysqlTable(
  'sys_user_post',
  {
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.postId] })],
);
