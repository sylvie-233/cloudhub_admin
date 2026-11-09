import type {
  Logininfor,
  LogininforQuery,
  LogininforStats,
  PageResult,
} from '@cloudhub/types';
import { normalizePagination, paginate } from '@cloudhub/utils';

import { dbClient } from '../db/index.js';
import {
  buildLogFilter,
  countLogininfors,
  deleteAllLogininfors,
  deleteLogininforsByIds,
  loginStatsToday,
  loginStatsWeek,
  selectLogininforById,
  selectLogininforsForExport,
  selectLogininforsPage,
} from '../sql/log.sql.js';
import type { LoginRecordInput, LogininforRow } from '../sql/log.sql.js';
import { HttpError } from '../utils/http.js';

export type { LoginRecordInput };

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

/** 登录日志分页列表。 */
export async function listLogininfors(
  query: LogininforQuery,
): Promise<PageResult<Logininfor>> {
  const filter = buildLogFilter(query);
  const { page, pageSize, offset } = normalizePagination(query, 8);

  const countStmt = countLogininfors(filter);
  const countRow = await dbClient.queryOne<{ total: number }>(
    countStmt.sql,
    countStmt.params,
  );
  const total = Number(countRow?.total ?? 0);

  const pageStmt = selectLogininforsPage(filter, pageSize, offset);
  const rows = await dbClient.query<LogininforRow>(pageStmt.sql, pageStmt.params);

  return paginate(rows, total, page, pageSize);
}

/** 导出用全量查询（限制上限，避免一次性拉爆内存）。 */
export async function listLogininforsForExport(
  query: LogininforQuery,
): Promise<Logininfor[]> {
  const stmt = selectLogininforsForExport(buildLogFilter(query));
  return dbClient.query<LogininforRow>(stmt.sql, stmt.params);
}

/** 登录日志详情。 */
export async function getLogininfor(infoId: number): Promise<Logininfor> {
  const stmt = selectLogininforById(infoId);
  const row = await dbClient.queryOne<LogininforRow>(stmt.sql, stmt.params);
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
  const stmt = deleteLogininforsByIds(infoIds);
  const result = await dbClient.execute(stmt.sql, stmt.params);
  return result.affectedRows;
}

/** 清空全部登录日志。 */
export async function cleanLogininfors(): Promise<number> {
  const stmt = deleteAllLogininfors();
  const result = await dbClient.execute(stmt.sql, stmt.params);
  return result.affectedRows;
}

/** 日志概览：今日成功/失败与近 7 天活跃账号数。 */
export async function getLogininforStats(): Promise<LogininforStats> {
  const today = await dbClient.queryOne<{
    total: number;
    success: number;
    fail: number;
  }>(loginStatsToday.sql, loginStatsToday.params);

  const week = await dbClient.queryOne<{ total: number }>(
    loginStatsWeek.sql,
    loginStatsWeek.params,
  );

  return {
    todayCount: Number(today?.total ?? 0),
    todaySuccess: Number(today?.success ?? 0),
    todayFail: Number(today?.fail ?? 0),
    weekUniqueUsers: Number(week?.total ?? 0),
  };
}
