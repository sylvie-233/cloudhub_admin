import * as permService from '../services/perm.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson } from '../utils/validate.js';
import { saveMenusSchema, setDataScopeSchema } from '../validators/perm.js';

/* ========================= 角色权限 ========================= */

/** GET /api/perms/role/:roleId */
export async function getRolePermission(c: AppContext): Promise<Response> {
  return success(c, await permService.getRolePermission(parseId(c, 'roleId')));
}

/** PUT /api/perms/role/:roleId/menus */
export async function saveRoleMenus(c: AppContext): Promise<Response> {
  const input = await parseJson(c, saveMenusSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await permService.saveRoleMenus(parseId(c, 'roleId'), input.menuIds, operator),
    '角色权限已保存',
  );
}

/** PUT /api/perms/role/:roleId/data-scope */
export async function saveRoleDataScope(c: AppContext): Promise<Response> {
  const input = await parseJson(c, setDataScopeSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await permService.setRoleDataScope(parseId(c, 'roleId'), input, operator),
    '数据权限已保存',
  );
}

/* ========================= 岗位权限 ========================= */

/** GET /api/perms/post/:postId */
export async function getPostPermission(c: AppContext): Promise<Response> {
  return success(c, await permService.getPostPermission(parseId(c, 'postId')));
}

/** PUT /api/perms/post/:postId/menus */
export async function savePostMenus(c: AppContext): Promise<Response> {
  const input = await parseJson(c, saveMenusSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await permService.savePostMenus(parseId(c, 'postId'), input.menuIds, operator),
    '岗位权限已保存',
  );
}

/* ========================= 组织权限 ========================= */

/** GET /api/perms/org/:orgId */
export async function getOrgPermission(c: AppContext): Promise<Response> {
  return success(c, await permService.getOrgPermission(parseId(c, 'orgId')));
}

/** PUT /api/perms/org/:orgId/menus */
export async function saveOrgMenus(c: AppContext): Promise<Response> {
  const input = await parseJson(c, saveMenusSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await permService.saveOrgMenus(parseId(c, 'orgId'), input.menuIds, operator),
    '组织权限已保存',
  );
}
