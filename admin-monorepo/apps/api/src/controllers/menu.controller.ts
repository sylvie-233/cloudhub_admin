import * as menuService from '../services/menu.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import {
  createMenuSchema,
  menuQuerySchema,
  updateMenuSchema,
} from '../validators/menu.js';

/** GET /api/menus */
export async function listMenus(c: AppContext): Promise<Response> {
  const query = parseQuery(c, menuQuerySchema);
  return success(c, await menuService.listMenus(query));
}

/** GET /api/menus/tree */
export async function getMenuTree(c: AppContext): Promise<Response> {
  return success(c, await menuService.getMenuTree());
}

/** GET /api/menus/:id */
export async function getMenu(c: AppContext): Promise<Response> {
  return success(c, await menuService.getMenuDetail(parseId(c)));
}

/** POST /api/menus */
export async function createMenu(c: AppContext): Promise<Response> {
  const input = await parseJson(c, createMenuSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await menuService.createMenu(input, operator),
    '菜单创建成功，已默认授权给超级管理员',
  );
}

/** PUT /api/menus/:id */
export async function updateMenu(c: AppContext): Promise<Response> {
  const input = await parseJson(c, updateMenuSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await menuService.updateMenu(parseId(c), input, operator), '菜单已更新');
}

/** DELETE /api/menus/:id */
export async function deleteMenu(c: AppContext): Promise<Response> {
  await menuService.deleteMenu(parseId(c));
  return success(c, null, '菜单已删除，相关授权已同步清理');
}
