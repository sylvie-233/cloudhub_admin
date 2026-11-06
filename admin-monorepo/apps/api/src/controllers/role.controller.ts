import * as roleService from '../services/role.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import {
  assignRoleUsersSchema,
  createRoleSchema,
  roleQuerySchema,
  updateRoleSchema,
} from '../validators/role.js';

/** GET /api/roles */
export async function listRoles(c: AppContext): Promise<Response> {
  const query = parseQuery(c, roleQuerySchema);
  return success(c, await roleService.listRoles(query));
}

/** GET /api/roles/:id */
export async function getRole(c: AppContext): Promise<Response> {
  return success(c, await roleService.getRoleDetail(parseId(c)));
}

/** POST /api/roles */
export async function createRole(c: AppContext): Promise<Response> {
  const input = await parseJson(c, createRoleSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await roleService.createRole(input, operator), '角色创建成功，请配置菜单权限');
}

/** PUT /api/roles/:id */
export async function updateRole(c: AppContext): Promise<Response> {
  const input = await parseJson(c, updateRoleSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await roleService.updateRole(parseId(c), input, operator), '角色已更新');
}

/** DELETE /api/roles/:id */
export async function deleteRole(c: AppContext): Promise<Response> {
  const operator = c.get('currentUser').userName;
  await roleService.deleteRole(parseId(c), operator);
  return success(c, null, '角色已删除');
}

/** GET /api/roles/:id/users */
export async function listRoleUsers(c: AppContext): Promise<Response> {
  return success(c, await roleService.listRoleUsers(parseId(c)));
}

/** PUT /api/roles/:id/users */
export async function assignRoleUsers(c: AppContext): Promise<Response> {
  const input = await parseJson(c, assignRoleUsersSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await roleService.assignRoleUsers(parseId(c), input.userIds, operator),
    '角色成员已更新',
  );
}
