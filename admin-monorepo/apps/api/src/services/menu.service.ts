import type {
  CreateMenuInput,
  Menu,
  MenuQuery,
  MenuRow,
  MenuTreeNode,
  Status,
  UpdateMenuInput,
} from '@cloudhub/types';
import { dbClient, executeOn } from '../db/index.js';
import { HttpError } from '../utils/http.js';

interface MenuDbRow {
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

const MENU_COLUMNS = `menu_id AS menuId, menu_name AS menuName, parent_id AS parentId,
  order_num AS orderNum, path, component, menu_type AS menuType, status, perms, icon,
  create_by AS createBy, create_time AS createTime,
  update_by AS updateBy, update_time AS updateTime`;

async function findMenuRow(menuId: number): Promise<MenuDbRow | null> {
  return dbClient.queryOne<MenuDbRow>(
    `SELECT ${MENU_COLUMNS} FROM sys_menu WHERE menu_id = ? LIMIT 1`,
    [menuId],
  );
}

async function requireMenu(menuId: number): Promise<MenuDbRow> {
  const menu = await findMenuRow(menuId);
  if (!menu) {
    throw new HttpError(404, '菜单不存在');
  }
  return menu;
}

function toMenu(row: MenuDbRow): Menu {
  return { ...row };
}

async function loadAllMenus(): Promise<MenuDbRow[]> {
  return dbClient.query<MenuDbRow>(
    `SELECT ${MENU_COLUMNS} FROM sys_menu ORDER BY order_num, menu_id`,
  );
}

function buildChildrenMap(rows: MenuDbRow[]): Map<number, MenuDbRow[]> {
  const map = new Map<number, MenuDbRow[]>();
  for (const row of rows) {
    const list = map.get(row.parentId) ?? [];
    list.push(row);
    map.set(row.parentId, list);
  }
  return map;
}

/** 菜单扁平列表：默认按树展开，带筛选条件时改为平铺展示。 */
export async function listMenus(query: MenuQuery): Promise<MenuRow[]> {
  const rows = await loadAllMenus();
  const childrenMap = buildChildrenMap(rows);
  const hasChild = (menuId: number): boolean => (childrenMap.get(menuId)?.length ?? 0) > 0;

  const keyword = query.keyword?.toLowerCase();
  if (keyword || query.menuType) {
    return rows
      .filter((row) => {
        const matchKeyword =
          !keyword ||
          row.menuName.toLowerCase().includes(keyword) ||
          (row.perms ?? '').toLowerCase().includes(keyword);
        const matchType = !query.menuType || row.menuType === query.menuType;
        return matchKeyword && matchType;
      })
      .map((row) => ({ ...toMenu(row), level: 0, hasChild: hasChild(row.menuId) }));
  }

  const result: MenuRow[] = [];
  const visited = new Set<number>();
  const walk = (parentId: number, level: number): void => {
    for (const row of childrenMap.get(parentId) ?? []) {
      if (visited.has(row.menuId)) {
        continue;
      }
      visited.add(row.menuId);
      result.push({ ...toMenu(row), level, hasChild: hasChild(row.menuId) });
      walk(row.menuId, level + 1);
    }
  };
  walk(0, 0);

  return result;
}

/** 菜单树（含动作节点）。 */
export async function getMenuTree(): Promise<MenuTreeNode[]> {
  const rows = await loadAllMenus();
  const nodes = new Map<number, MenuTreeNode>();
  for (const row of rows) {
    nodes.set(row.menuId, { ...toMenu(row), children: [] });
  }

  const roots: MenuTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent && parent.menuId !== node.menuId) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const visited = new Set<number>();
  const sortNodes = (list: MenuTreeNode[]): void => {
    list.sort((a, b) => a.orderNum - b.orderNum || a.menuId - b.menuId);
    for (const node of list) {
      if (visited.has(node.menuId)) {
        continue;
      }
      visited.add(node.menuId);
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

/** 菜单详情。 */
export async function getMenuDetail(menuId: number): Promise<Menu> {
  return toMenu(await requireMenu(menuId));
}

/** 校验上级菜单：必须存在且不能是动作节点。 */
async function assertParent(parentId: number, selfId?: number): Promise<void> {
  if (parentId === 0) {
    return;
  }
  if (selfId !== undefined && parentId === selfId) {
    throw new HttpError(400, '上级菜单不能是自己');
  }
  const parent = await findMenuRow(parentId);
  if (!parent) {
    throw new HttpError(400, '上级菜单不存在');
  }
  if (parent.menuType === 'F') {
    throw new HttpError(400, '动作类型不能作为上级菜单');
  }
}

/** 新增菜单，并默认授权给超级管理员角色。 */
export async function createMenu(
  input: CreateMenuInput,
  operator: string,
): Promise<Menu> {
  const parentId = input.parentId ?? 0;
  await assertParent(parentId);

  const menuId = await dbClient.transaction(async (conn) => {
    const result = await executeOn(
      conn,
      `INSERT INTO sys_menu
        (menu_name, parent_id, order_num, path, component, menu_type, status, perms, icon, create_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.menuName,
        parentId,
        input.orderNum ?? 0,
        input.path ?? '',
        input.component ?? null,
        input.menuType,
        input.status ?? '0',
        input.perms ?? null,
        input.icon ?? '',
        operator,
      ],
    );

    await executeOn(
      conn,
      `INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, ?)`,
      [result.insertId],
    );

    return result.insertId;
  });

  return getMenuDetail(menuId);
}

/** 修改菜单：防止移动到自己的后代节点下，动作节点不能有子级。 */
export async function updateMenu(
  menuId: number,
  input: UpdateMenuInput,
  operator: string,
): Promise<Menu> {
  const current = await requireMenu(menuId);
  const parentId = input.parentId ?? current.parentId;
  const menuType = input.menuType ?? current.menuType;

  await assertParent(parentId, menuId);

  if (parentId !== current.parentId) {
    const rows = await loadAllMenus();
    const parentMap = new Map(rows.map((row) => [row.menuId, row.parentId]));
    let cursor: number | undefined = parentId;
    const visited = new Set<number>();
    while (cursor && cursor > 0) {
      if (cursor === menuId) {
        throw new HttpError(400, '不能把菜单移动到自己的下级菜单下');
      }
      if (visited.has(cursor)) {
        break;
      }
      visited.add(cursor);
      cursor = parentMap.get(cursor);
    }
  }

  if (menuType === 'F') {
    const childCount = await dbClient.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM sys_menu WHERE parent_id = ?`,
      [menuId],
    );
    if (Number(childCount?.total ?? 0) > 0) {
      throw new HttpError(400, '该菜单下存在子节点，不能改为动作类型');
    }
  }

  await dbClient.execute(
    `UPDATE sys_menu
        SET menu_name = ?, parent_id = ?, order_num = ?, path = ?, component = ?,
            menu_type = ?, status = ?, perms = ?, icon = ?, update_by = ?, update_time = NOW()
      WHERE menu_id = ?`,
    [
      input.menuName ?? current.menuName,
      parentId,
      input.orderNum ?? current.orderNum,
      input.path ?? current.path,
      input.component === undefined ? current.component : input.component,
      menuType,
      input.status ?? current.status,
      input.perms === undefined ? current.perms : input.perms,
      input.icon ?? current.icon,
      operator,
      menuId,
    ],
  );

  return getMenuDetail(menuId);
}

/** 删除菜单：存在子菜单时禁止；同步清理三类授权关系。 */
export async function deleteMenu(menuId: number): Promise<void> {
  await requireMenu(menuId);

  const childCount = await dbClient.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_menu WHERE parent_id = ?`,
    [menuId],
  );
  if (Number(childCount?.total ?? 0) > 0) {
    throw new HttpError(400, '该菜单下存在子菜单，需先删除下级菜单');
  }

  await dbClient.transaction(async (conn) => {
    await executeOn(conn, `DELETE FROM sys_role_menu WHERE menu_id = ?`, [menuId]);
    await executeOn(conn, `DELETE FROM sys_post_menu WHERE menu_id = ?`, [menuId]);
    await executeOn(conn, `DELETE FROM sys_org_menu WHERE menu_id = ?`, [menuId]);
    await executeOn(conn, `DELETE FROM sys_menu WHERE menu_id = ?`, [menuId]);
  });
}
