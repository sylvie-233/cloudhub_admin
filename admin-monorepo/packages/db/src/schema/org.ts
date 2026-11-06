import { sql } from 'drizzle-orm';
import { bigint, char, datetime, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/**
 * 组织表：ancestors 保存逗号分隔的祖级路径，最多 9 级。
 * 责任岗位唯一来源为 leader_post_id，岗位表不再冗余 is_leader。
 */
export const sysOrg = mysqlTable('sys_org', {
  orgId: bigint('org_id', { mode: 'number' }).autoincrement().primaryKey(),
  parentId: bigint('parent_id', { mode: 'number' }).notNull().default(0),
  ancestors: varchar('ancestors', { length: 500 }).notNull().default(''),
  orgCode: varchar('org_code', { length: 64 }).notNull(),
  orgName: varchar('org_name', { length: 100 }).notNull(),
  orgLevel: int('org_level').notNull().default(1),
  orderNum: int('order_num').notNull().default(0),
  leaderPostId: bigint('leader_post_id', { mode: 'number' }),
  status: char('status', { length: 1 }).notNull().default('0'),
  delFlag: char('del_flag', { length: 1 }).notNull().default('0'),
  createBy: varchar('create_by', { length: 64 }).notNull().default(''),
  createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updateBy: varchar('update_by', { length: 64 }).notNull().default(''),
  updateTime: datetime('update_time', { mode: 'string' }),
});
