import type { SqlStatement } from './shared.js';

/** 工作台：组织数、最大层级与已设置责任岗位的组织数。 */
export const dashboardOrgStats: SqlStatement = {
  sql: `SELECT COUNT(*) AS orgCount,
          COALESCE(MAX(org_level), 0) AS orgMaxLevel,
          SUM(leader_post_id IS NOT NULL) AS leaderPostCount
     FROM sys_org WHERE del_flag = '0'`,
  params: [],
};

/** 工作台：岗位数。 */
export const dashboardPostStats: SqlStatement = {
  sql: `SELECT COUNT(*) AS postCount FROM sys_post WHERE del_flag = '0'`,
  params: [],
};

/** 工作台：用户数及正常 / 停用数量。 */
export const dashboardUserStats: SqlStatement = {
  sql: `SELECT COUNT(*) AS userCount,
          SUM(status = '0') AS activeUserCount,
          SUM(status = '1') AS disabledUserCount
     FROM sys_user WHERE del_flag = '0'`,
  params: [],
};

/** 工作台：角色数。 */
export const dashboardRoleStats: SqlStatement = {
  sql: `SELECT COUNT(*) AS roleCount FROM sys_role WHERE del_flag = '0'`,
  params: [],
};

/** 工作台：组织在岗人数 Top 8。 */
export const dashboardOrgHeadcounts: SqlStatement = {
  sql: `SELECT o.org_id AS orgId, o.org_name AS orgName,
          COUNT(DISTINCT u.user_id) AS headcount
     FROM sys_org o
     JOIN sys_post p ON p.org_id = o.org_id AND p.del_flag = '0' AND p.status = '0'
     JOIN sys_user_post up ON up.post_id = p.post_id
     JOIN sys_user u ON u.user_id = up.user_id AND u.del_flag = '0' AND u.status = '0'
    WHERE o.del_flag = '0'
    GROUP BY o.org_id, o.org_name, o.order_num
    ORDER BY headcount DESC, o.order_num, o.org_id
    LIMIT 8`,
  params: [],
};

/** 工作台：最近 6 条登录记录。 */
export const dashboardRecentLogins: SqlStatement = {
  sql: `SELECT info_id AS infoId, user_name AS userName, post_name AS postName,
          ipaddr, login_location AS loginLocation, browser, os, status, msg,
          login_time AS loginTime
     FROM sys_logininfor
    ORDER BY login_time DESC, info_id DESC
    LIMIT 6`,
  params: [],
};
