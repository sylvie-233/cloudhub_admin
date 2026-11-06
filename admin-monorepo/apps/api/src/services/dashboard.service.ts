import type { DashboardStats, OrgHeadcount } from '@cloudhub/types';

import { dbClient } from '../db/index.js';

/** 工作台统计：组织/岗位/用户/角色概览 + 组织人数 Top 8 + 最近登录。 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orgRow, postRow, userRow, roleRow, orgHeadcounts, recentLogins] =
    await Promise.all([
      dbClient.queryOne<{ orgCount: number; orgMaxLevel: number; leaderPostCount: number }>(
        `SELECT COUNT(*) AS orgCount,
                COALESCE(MAX(org_level), 0) AS orgMaxLevel,
                SUM(leader_post_id IS NOT NULL) AS leaderPostCount
           FROM sys_org WHERE del_flag = '0'`,
      ),
      dbClient.queryOne<{ postCount: number }>(
        `SELECT COUNT(*) AS postCount FROM sys_post WHERE del_flag = '0'`,
      ),
      dbClient.queryOne<{
        userCount: number;
        activeUserCount: number;
        disabledUserCount: number;
      }>(
        `SELECT COUNT(*) AS userCount,
                SUM(status = '0') AS activeUserCount,
                SUM(status = '1') AS disabledUserCount
           FROM sys_user WHERE del_flag = '0'`,
      ),
      dbClient.queryOne<{ roleCount: number }>(
        `SELECT COUNT(*) AS roleCount FROM sys_role WHERE del_flag = '0'`,
      ),
      dbClient.query<OrgHeadcount>(
        `SELECT o.org_id AS orgId, o.org_name AS orgName,
                COUNT(DISTINCT u.user_id) AS headcount
           FROM sys_org o
           JOIN sys_post p ON p.org_id = o.org_id AND p.del_flag = '0' AND p.status = '0'
           JOIN sys_user_post up ON up.post_id = p.post_id
           JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
          WHERE o.del_flag = '0'
          GROUP BY o.org_id, o.org_name, o.order_num
          ORDER BY headcount DESC, o.order_num, o.org_id
          LIMIT 8`,
      ),
      dbClient.query<DashboardStats['recentLogins'][number]>(
        `SELECT info_id AS infoId, user_name AS userName, post_name AS postName,
                ipaddr, login_location AS loginLocation, browser, os, status, msg,
                login_time AS loginTime
           FROM sys_logininfor
          ORDER BY login_time DESC, info_id DESC
          LIMIT 6`,
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
