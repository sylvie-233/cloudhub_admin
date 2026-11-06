import type {
  Logininfor,
  LogininforQuery,
  LogininforStats,
  PageResult,
  Status,
} from '@cloudhub/types';
import { escapeLike, normalizePagination, paginate, placeholders } from '@cloudhub/utils';

import { dbClient } from '../db/index.js';
import { HttpError } from '../utils/http.js';

interface LogininforRow {
  infoId: number;
  userName: string;
  postName: string;
  ipaddr: string;
  loginLocation: string;
  browser: string;
  os: string;
  status: Status;
  msg: string;
  loginTime: string;
}

export interface LoginRecordInput {
  userName: string;
  postName: string;
  ipaddr: string;
  loginLocation: string;
  browser: string;
  os: string;
  status: Status;
  msg: string;
}

const LOG_COLUMNS = `info_id AS infoId, user_name AS userName, post_name AS postName,
  ipaddr, login_location AS loginLocation, browser, os, status, msg,
  login_time AS loginTime`;

/** 写入一条登录日志；登录成功与失败都需要记录。 */
export async function recordLogin(input: LoginRecordInput): Promise<void> {
  await dbClient.execute(
    `INSERT INTO sys_logininfor
      (user_name, post_name, ipaddr, login_location, browser, os, status, msg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userName,
      input.postName,
      input.ipaddr,
      input.loginLocation,
      input.browser,
      input.os,
      input.status,
      input.msg,
    ],
  );
}

/** 结束时间只传日期时补全到当天 23:59:59。 */
function normalizeEndTime(value: string): string {
  return value.length === 10 ? `${value} 23:59:59` : value;
}

function buildLogFilter(query: LogininforQuery): { whereSql: string; params: unknown[] } {
  const conditions = ['1 = 1'];
  const params: unknown[] = [];

  if (query.keyword) {
    conditions.push(
      `(user_name LIKE ? OR ipaddr LIKE ? OR login_location LIKE ? OR post_name LIKE ?
        OR msg LIKE ? OR browser LIKE ? OR os LIKE ?)`,
    );
    const pattern = `%${escapeLike(query.keyword)}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  if (query.days) {
    conditions.push('login_time >= DATE_SUB(NOW(), INTERVAL ? DAY)');
    params.push(query.days);
  }
  if (query.startTime) {
    conditions.push('login_time >= ?');
    params.push(query.startTime);
  }
  if (query.endTime) {
    conditions.push('login_time <= ?');
    params.push(normalizeEndTime(query.endTime));
  }

  return { whereSql: conditions.join(' AND '), params };
}

/** 登录日志分页列表。 */
export async function listLogininfors(
  query: LogininforQuery,
): Promise<PageResult<Logininfor>> {
  const { whereSql, params } = buildLogFilter(query);
  const { page, pageSize, offset } = normalizePagination(query, 8);

  const countRow = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_logininfor WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const rows = await dbClient.query<LogininforRow>(
    `SELECT ${LOG_COLUMNS} FROM sys_logininfor
      WHERE ${whereSql}
      ORDER BY login_time DESC, info_id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return paginate(rows, total, page, pageSize);
}

/** 导出用全量查询（限制上限，避免一次性拉爆内存）。 */
export async function listLogininforsForExport(
  query: LogininforQuery,
): Promise<Logininfor[]> {
  const { whereSql, params } = buildLogFilter(query);
  return dbClient.query<LogininforRow>(
    `SELECT ${LOG_COLUMNS} FROM sys_logininfor
      WHERE ${whereSql}
      ORDER BY login_time DESC, info_id DESC
      LIMIT 10000`,
    params,
  );
}

/** 登录日志详情。 */
export async function getLogininfor(infoId: number): Promise<Logininfor> {
  const row = await dbClient.queryOne<LogininforRow>(
    `SELECT ${LOG_COLUMNS} FROM sys_logininfor WHERE info_id = ? LIMIT 1`,
    [infoId],
  );
  if (!row) {
    throw new HttpError(404, '日志不存在');
  }
  return row;
}

/** 批量删除登录日志。 */
export async function deleteLogininfors(infoIds: number[]): Promise<number> {
  if (infoIds.length === 0) {
    return 0;
  }
  const result = await dbClient.execute(
    `DELETE FROM sys_logininfor WHERE info_id IN (${placeholders(infoIds.length)})`,
    infoIds,
  );
  return result.affectedRows;
}

/** 清空全部登录日志。 */
export async function cleanLogininfors(): Promise<number> {
  const result = await dbClient.execute(`DELETE FROM sys_logininfor`);
  return result.affectedRows;
}

/** 日志概览：今日成功/失败与近 7 天活跃账号数。 */
export async function getLogininforStats(): Promise<LogininforStats> {
  const today = await dbClient.queryOne<{
    total: number;
    success: number;
    fail: number;
  }>(
    `SELECT COUNT(*) AS total,
            SUM(status = '0') AS success,
            SUM(status = '1') AS fail
       FROM sys_logininfor
      WHERE login_time >= CURDATE()`,
  );

  const week = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT user_name) AS total
       FROM sys_logininfor
      WHERE login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
  );

  return {
    todayCount: Number(today?.total ?? 0),
    todaySuccess: Number(today?.success ?? 0),
    todayFail: Number(today?.fail ?? 0),
    weekUniqueUsers: Number(week?.total ?? 0),
  };
}
