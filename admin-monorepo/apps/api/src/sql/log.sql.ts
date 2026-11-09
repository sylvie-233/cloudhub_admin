import type { LogininforQuery, Status } from '@cloudhub/types';
import { placeholders } from '@cloudhub/utils';

import type { SqlFragment, SqlStatement } from './shared.js';
import { likePattern } from './shared.js';

export interface LogininforRow {
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

export const LOG_COLUMNS = `info_id AS infoId, user_name AS userName, post_name AS postName,
  ipaddr, login_location AS loginLocation, browser, os, status, msg,
  login_time AS loginTime`;

/** 结束时间只传日期时补全到当天 23:59:59。 */
function normalizeEndTime(value: string): string {
  return value.length === 10 ? `${value} 23:59:59` : value;
}

/** 登录日志筛选条件，供列表、导出与计数共用。 */
export function buildLogFilter(query: LogininforQuery): SqlFragment {
  const conditions = ['1 = 1'];
  const params: unknown[] = [];

  if (query.keyword) {
    conditions.push(
      `(user_name LIKE ? OR ipaddr LIKE ? OR login_location LIKE ? OR post_name LIKE ?
        OR msg LIKE ? OR browser LIKE ? OR os LIKE ?)`,
    );
    const pattern = likePattern(query.keyword);
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

  return { sql: conditions.join(' AND '), params };
}

/** 登录日志总数。 */
export function countLogininfors(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total FROM sys_logininfor WHERE ${filter.sql}`,
    params: filter.params,
  };
}

/** 登录日志分页列表。 */
export function selectLogininforsPage(
  filter: SqlFragment,
  pageSize: number,
  offset: number,
): SqlStatement {
  return {
    sql: `SELECT ${LOG_COLUMNS} FROM sys_logininfor
      WHERE ${filter.sql}
      ORDER BY login_time DESC, info_id DESC
      LIMIT ? OFFSET ?`,
    params: [...filter.params, pageSize, offset],
  };
}

/** 导出用全量查询（限制上限，避免一次性拉爆内存）。 */
export function selectLogininforsForExport(filter: SqlFragment): SqlStatement {
  return {
    sql: `SELECT ${LOG_COLUMNS} FROM sys_logininfor
      WHERE ${filter.sql}
      ORDER BY login_time DESC, info_id DESC
      LIMIT 10000`,
    params: filter.params,
  };
}

/** 登录日志详情。 */
export function selectLogininforById(infoId: number): SqlStatement {
  return {
    sql: `SELECT ${LOG_COLUMNS} FROM sys_logininfor WHERE info_id = ? LIMIT 1`,
    params: [infoId],
  };
}

/** 批量删除登录日志。 */
export function deleteLogininforsByIds(infoIds: number[]): SqlStatement {
  return {
    sql: `DELETE FROM sys_logininfor WHERE info_id IN (${placeholders(infoIds.length)})`,
    params: infoIds,
  };
}

/** 清空全部登录日志。 */
export function deleteAllLogininfors(): SqlStatement {
  return {
    sql: `DELETE FROM sys_logininfor`,
    params: [],
  };
}

/** 今日登录总数与成功 / 失败数。 */
export const loginStatsToday: SqlStatement = {
  sql: `SELECT COUNT(*) AS total,
          SUM(status = '0') AS success,
          SUM(status = '1') AS fail
     FROM sys_logininfor
    WHERE login_time >= CURDATE()`,
  params: [],
};

/** 近 7 天活跃账号数。 */
export const loginStatsWeek: SqlStatement = {
  sql: `SELECT COUNT(DISTINCT user_name) AS total
     FROM sys_logininfor
    WHERE login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
  params: [],
};
