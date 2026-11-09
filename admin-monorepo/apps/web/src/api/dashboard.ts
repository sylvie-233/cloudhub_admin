import type { DashboardStats } from '@cloudhub/types';

import { request } from './client';

export const dashboardApi = {
  /** 工作台统计 */
  stats(): Promise<DashboardStats> {
    return request<DashboardStats>('/dashboard/stats');
  },
};
