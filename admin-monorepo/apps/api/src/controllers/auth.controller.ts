import * as authService from '../services/auth.service.js';
import type { AppContext } from '../types/context.js';
import { getClientInfo } from '../utils/client.js';
import { success } from '../utils/http.js';
import { parseJson } from '../utils/validate.js';
import { loginSchema } from '../validators/auth.js';

/** POST /api/auth/login */
export async function login(c: AppContext): Promise<Response> {
  const input = await parseJson(c, loginSchema);
  const data = await authService.login(input, getClientInfo(c));
  return success(c, data, '登录成功');
}

/** GET /api/auth/me */
export async function me(c: AppContext): Promise<Response> {
  const { userId, postId } = c.get('currentUser');
  const data = await authService.getProfile(userId, postId);
  return success(c, data);
}

/** POST /api/auth/refresh */
export async function refresh(c: AppContext): Promise<Response> {
  const { userId, userName, postId } = c.get('currentUser');
  const data = await authService.refresh(userId, userName, postId);
  return success(c, data, '登录状态已续期');
}

/** POST /api/auth/logout */
export function logout(c: AppContext): Response {
  return success(c, null, '已退出登录');
}
