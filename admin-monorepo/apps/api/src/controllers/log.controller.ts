import { formatDate, toCsv } from '@cloudhub/utils';

import * as logService from '../services/log.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import { deleteLogsSchema, logininforQuerySchema } from '../validators/log.js';

/** GET /api/logs/logininfor */
export async function listLogininfors(c: AppContext): Promise<Response> {
  const query = parseQuery(c, logininforQuerySchema);
  return success(c, await logService.listLogininfors(query));
}

/** GET /api/logs/logininfor/stats */
export async function getLogininforStats(c: AppContext): Promise<Response> {
  return success(c, await logService.getLogininforStats());
}

/** GET /api/logs/logininfor/export */
export async function exportLogininfors(c: AppContext): Promise<Response> {
  const query = parseQuery(c, logininforQuerySchema);
  const rows = await logService.listLogininforsForExport(query);

  const csv = toCsv(
    [
      '序号',
      '登录账号',
      '登录岗位',
      'IP 地址',
      '登录地点',
      '浏览器',
      '操作系统',
      '状态',
      '提示消息',
      '登录时间',
    ],
    rows.map((row) => [
      row.infoId,
      row.userName,
      row.postName || '-',
      row.ipaddr,
      row.loginLocation,
      row.browser,
      row.os,
      row.status === '0' ? '成功' : '失败',
      row.msg,
      row.loginTime,
    ]),
  );

  const fileName = `登录日志_${formatDate()}.csv`;
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="login-logs.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  });
}

/** GET /api/logs/logininfor/:id */
export async function getLogininfor(c: AppContext): Promise<Response> {
  return success(c, await logService.getLogininfor(parseId(c)));
}

/** DELETE /api/logs/logininfor */
export async function deleteLogininfors(c: AppContext): Promise<Response> {
  const input = await parseJson(c, deleteLogsSchema);
  const affected = await logService.deleteLogininfors(input.ids);
  return success(c, { affected }, `已删除 ${affected} 条日志`);
}

/** DELETE /api/logs/logininfor/clean */
export async function cleanLogininfors(c: AppContext): Promise<Response> {
  const affected = await logService.cleanLogininfors();
  return success(c, { affected }, `已清空 ${affected} 条日志`);
}
