import * as userService from '../services/user.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import {
  assignRolesSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userQuerySchema,
} from '../validators/user.js';

/** GET /api/users */
export async function listUsers(c: AppContext): Promise<Response> {
  const query = parseQuery(c, userQuerySchema);
  const { userId } = c.get('currentUser');
  return success(c, await userService.listUsers(query, userId));
}

/** GET /api/users/:id */
export async function getUser(c: AppContext): Promise<Response> {
  return success(c, await userService.getUserDetail(parseId(c)));
}

/** POST /api/users */
export async function createUser(c: AppContext): Promise<Response> {
  const input = await parseJson(c, createUserSchema);
  const { userId, userName } = c.get('currentUser');
  return success(
    c,
    await userService.createUser(input, userName, userId),
    '用户创建成功',
  );
}

/** PUT /api/users/:id */
export async function updateUser(c: AppContext): Promise<Response> {
  const input = await parseJson(c, updateUserSchema);
  const { userId, userName } = c.get('currentUser');
  return success(
    c,
    await userService.updateUser(parseId(c), input, userName, userId),
    '用户信息已更新',
  );
}

/** DELETE /api/users/:id */
export async function deleteUser(c: AppContext): Promise<Response> {
  const operator = c.get('currentUser').userName;
  await userService.deleteUser(parseId(c), operator);
  return success(c, null, '用户已删除');
}

/** PUT /api/users/:id/password */
export async function resetPassword(c: AppContext): Promise<Response> {
  const input = await parseJson(c, resetPasswordSchema);
  const operator = c.get('currentUser').userName;
  await userService.resetUserPassword(parseId(c), input.password, operator);
  return success(c, null, '密码已重置');
}

/** PUT /api/users/:id/roles */
export async function assignRoles(c: AppContext): Promise<Response> {
  const input = await parseJson(c, assignRolesSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await userService.assignUserRoles(parseId(c), input.roleIds, operator),
    '用户角色已更新',
  );
}

/** GET /api/users/:id/permissions */
export async function getUserPermissions(c: AppContext): Promise<Response> {
  return success(c, await userService.getUserPermissionDetail(parseId(c)));
}
