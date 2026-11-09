import type { Status } from '@cloudhub/types';

import type { SqlStatement } from './shared.js';

export interface MenuDbRow {
  menuId: number;
  menuName: string;
  parentId: number;
  orderNum: number;
  path: string;
  component: string | null;
  menuType: 'M' | 'C' | 'F';
  status: Status;
  perms: string | null;
  icon: string;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

export const MENU_COLUMNS = `menu_id AS menuId, menu_name AS menuName, parent_id AS parentId,
  order_num AS orderNum, path, component, menu_type AS menuType, status, perms, icon,
  create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

/** 按主键读取菜单（含已停用记录，用于编辑校验）。 */
export function selectMenuById(menuId: number): SqlStatement {
  return {
    sql: `SELECT ${MENU_COLUMNS} FROM sys_menu WHERE menu_id = ? LIMIT 1`,
    params: [menuId],
  };
}

/** 全量菜单，按排序值展开。 */
export const allMenus: SqlStatement = {
  sql: `SELECT ${MENU_COLUMNS} FROM sys_menu ORDER BY order_num, menu_id`,
  params: [],
};

/** 菜单直接子节点数量。 */
export function selectMenuChildCount(menuId: number): SqlStatement {
  return {
    sql: `SELECT COUNT(*) AS total FROM sys_menu WHERE parent_id = ?`,
    params: [menuId],
  };
}

/** 查询占用同一路由地址的菜单，用于新增/修改时的重复校验。 */
export function selectMenuPathConflict(
  path: string,
  excludeMenuId?: number,
): SqlStatement {
  const excludeSql = excludeMenuId === undefined ? '' : 'AND menu_id <> ?';
  const params: Array<string | number> = [path];
  if (excludeMenuId !== undefined) {
    params.push(excludeMenuId);
  }
  return {
    sql: `SELECT menu_id AS menuId, menu_name AS menuName
            FROM sys_menu
           WHERE menu_type = 'C' AND path = ?
             ${excludeSql}
           LIMIT 1`,
    params,
  };
}
