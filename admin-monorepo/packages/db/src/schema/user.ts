import { sql } from 'drizzle-orm';
import { bigint, char, datetime, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/** 用户表：不直接归属组织，通过 sys_user_post 任职岗位。 */
export const sysUser = mysqlTable('sys_user', {
  userId: bigint('user_id', { mode: 'number' }).autoincrement().primaryKey(),
  userName: varchar('user_name', { length: 30 }).notNull(),
  nickName: varchar('nick_name', { length: 30 }).notNull(),
  email: varchar('email', { length: 50 }).notNull().default(''),
  phonenumber: varchar('phonenumber', { length: 11 }).notNull().default(''),
  sex: char('sex', { length: 1 }).notNull().default('0'),
  password: varchar('password', { length: 100 }).notNull().default(''),
  status: char('status', { length: 1 }).notNull().default('0'),
  delFlag: char('del_flag', { length: 1 }).notNull().default('0'),
  createBy: varchar('create_by', { length: 64 }).notNull().default(''),
  createTime: datetime('create_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updateBy: varchar('update_by', { length: 64 }).notNull().default(''),
  updateTime: datetime('update_time', { mode: 'string' }),
});
