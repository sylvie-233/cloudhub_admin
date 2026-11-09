import type { DashboardStats, OrgHeadcount } from '@cloudhub/types';
import { PERMS } from '@cloudhub/types';

import { dbClient } from '../db/index.js';
import {
  dashboardOrgHeadcounts,
  dashboardOrgStats,
  dashboardPostStats,
  dashboardRecentLogins,
  dashboardRoleStats,
  dashboardUserStats,
} from '../sql/dashboard.sql.js';
import { getUserPermissionStrings } from './permission.service.js';

/**
 * 工作台统计：组织/岗位/用户/角色概览 + 组织人数 Top 8 + 最近登录。
 * 各区块按当前用户的读取权限按需查询，无权限时返回空值，避免绕过接口鉴权泄露数据。
 */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const permissions = new Set(await getUserPermissionStrings(userId));
  const canReadOrg = permissions.has(PERMS.ORG_LIST);
  const canReadPost = permissions.has(PERMS.POST_QUERY);
  const canReadUser = permissions.has(PERMS.USER_LIST);
  const canReadRole =
    permissions.has(PERMS.ROLE_LIST) || permissions.has(PERMS.PERM_QUERY);
  const canReadLog = permissions.has(PERMS.LOGININFOR_LIST);
  const canReadHeadcounts = canReadOrg && canReadUser;

  const [orgRow, postRow, userRow, roleRow, orgHeadcounts, recentLogins] =
    await Promise.all([
      canReadOrg
        ? dbClient.queryOne<{ orgCount: number; orgMaxLevel: number; leaderPostCount: number }>(
            dashboardOrgStats.sql,
            dashboardOrgStats.params,
          )
        : Promise.resolve(null),
      canReadPost
        ? dbClient.queryOne<{ postCount: number }>(
            dashboardPostStats.sql,
            dashboardPostStats.params,
          )
        : Promise.resolve(null),
      canReadUser
        ? dbClient.queryOne<{
            userCount: number;
            activeUserCount: number;
            disabledUserCount: number;
          }>(dashboardUserStats.sql, dashboardUserStats.params)
        : Promise.resolve(null),
      canReadRole
        ? dbClient.queryOne<{ roleCount: number }>(
            dashboardRoleStats.sql,
            dashboardRoleStats.params,
          )
        : Promise.resolve(null),
      canReadHeadcounts
        ? dbClient.query<OrgHeadcount>(
            dashboardOrgHeadcounts.sql,
            dashboardOrgHeadcounts.params,
          )
        : Promise.resolve([]),
      canReadLog
        ? dbClient.query<DashboardStats['recentLogins'][number]>(
            dashboardRecentLogins.sql,
            dashboardRecentLogins.params,
          )
        : Promise.resolve([]),
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
