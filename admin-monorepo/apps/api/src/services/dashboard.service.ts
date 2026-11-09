import type { DashboardStats, OrgHeadcount } from '@cloudhub/types';

import { dbClient } from '../db/index.js';
import {
  dashboardOrgHeadcounts,
  dashboardOrgStats,
  dashboardPostStats,
  dashboardRecentLogins,
  dashboardRoleStats,
  dashboardUserStats,
} from '../sql/dashboard.sql.js';

/** 工作台统计：组织/岗位/用户/角色概览 + 组织人数 Top 8 + 最近登录。 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orgRow, postRow, userRow, roleRow, orgHeadcounts, recentLogins] =
    await Promise.all([
      dbClient.queryOne<{ orgCount: number; orgMaxLevel: number; leaderPostCount: number }>(
        dashboardOrgStats.sql,
        dashboardOrgStats.params,
      ),
      dbClient.queryOne<{ postCount: number }>(
        dashboardPostStats.sql,
        dashboardPostStats.params,
      ),
      dbClient.queryOne<{
        userCount: number;
        activeUserCount: number;
        disabledUserCount: number;
      }>(dashboardUserStats.sql, dashboardUserStats.params),
      dbClient.queryOne<{ roleCount: number }>(
        dashboardRoleStats.sql,
        dashboardRoleStats.params,
      ),
      dbClient.query<OrgHeadcount>(
        dashboardOrgHeadcounts.sql,
        dashboardOrgHeadcounts.params,
      ),
      dbClient.query<DashboardStats['recentLogins'][number]>(
        dashboardRecentLogins.sql,
        dashboardRecentLogins.params,
      ),
    ]);

  return {
    orgCount: Number(orgRow?.orgCount ?? 0),
    orgMaxLevel: Number(orgRow?.orgMaxLevel ?? 0),
    postCount: Number(postRow?.postCount ?? 0),
    leaderPostCount: Number(orgRow?.leaderPostCount ?? 0),
    userCount: Number(userRow?.userCount ?? 0),
    activeUserCount: Number(userRow?.activeUserCount ?? 0),
    disabledUserCount: Number(userRow?.disabledUserCount ?? 0),
    roleCount: Number(roleRow?.roleCount ?? 0),
    orgHeadcounts: orgHeadcounts.map((row) => ({
      orgId: row.orgId,
      orgName: row.orgName,
      headcount: Number(row.headcount),
    })),
    recentLogins,
  };
}
