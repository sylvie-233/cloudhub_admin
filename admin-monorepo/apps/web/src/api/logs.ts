import type {
  Logininfor,
  LogininforQuery,
  LogininforStats,
  PageResult,
} from '@cloudhub/types';

import { download, request } from './client';

export const logApi = {
  /** 分页查询登录日志 */
  list(query: LogininforQuery): Promise<PageResult<Logininfor>> {
    return request<PageResult<Logininfor>>('/logs/logininfor', {
      query: query,
    });
  },

  /** 今日 / 近 7 天统计 */
  stats(): Promise<LogininforStats> {
    return request<LogininforStats>('/logs/logininfor/stats');
  },

  detail(infoId: number): Promise<Logininfor> {
    return request<Logininfor>(`/logs/logininfor/${infoId}`);
  },

  /** 按 ID 批量删除 */
  remove(ids: number[]): Promise<null> {
    return request<null>('/logs/logininfor', { method: 'DELETE', body: { ids } });
  },

  /** 清空全部登录日志 */
  clean(): Promise<null> {
    return request<null>('/logs/logininfor/clean', { method: 'DELETE' });
  },

  /** 导出当前筛选结果为 CSV */
  exportCsv(query: LogininforQuery): Promise<void> {
    return download(
      '/logs/logininfor/export',
      query,
      'login-logs.csv',
    );
  },
};
