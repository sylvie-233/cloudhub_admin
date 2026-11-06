import { sql } from 'drizzle-orm';
import { bigint, char, datetime, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/** 登录日志：登录成功与失败都会记录。 */
export const sysLogininfor = mysqlTable('sys_logininfor', {
  infoId: bigint('info_id', { mode: 'number' }).autoincrement().primaryKey(),
  userName: varchar('user_name', { length: 50 }).notNull().default(''),
  postName: varchar('post_name', { length: 100 }).notNull().default(''),
  ipaddr: varchar('ipaddr', { length: 128 }).notNull().default(''),
  loginLocation: varchar('login_location', { length: 255 }).notNull().default(''),
  browser: varchar('browser', { length: 50 }).notNull().default(''),
  os: varchar('os', { length: 50 }).notNull().default(''),
  status: char('status', { length: 1 }).notNull().default('0'),
  msg: varchar('msg', { length: 255 }).notNull().default(''),
  loginTime: datetime('login_time', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
