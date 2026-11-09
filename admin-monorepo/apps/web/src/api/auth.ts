import type { LoginInput, LoginResult, UserProfile } from '@cloudhub/types';

import { request } from './client';

export const authApi = {
  /** 账号登录 */
  login(input: LoginInput): Promise<LoginResult> {
    return request<LoginResult>('/auth/login', {
      method: 'POST',
      body: input,
      skipUnauthorizedHandling: true,
    });
  },

  /** 当前登录用户资料、权限与菜单 */
  me(): Promise<UserProfile> {
    return request<UserProfile>('/auth/me');
  },

  /** 续期访问令牌 */
  refresh(): Promise<LoginResult> {
    return request<LoginResult>('/auth/refresh', { method: 'POST' });
  },

  /** 退出登录（JWT 无状态，服务端仅记录成功） */
  logout(): Promise<null> {
    return request<null>('/auth/logout', { method: 'POST' });
  },
};
