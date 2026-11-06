import type { Context } from 'hono';

/** 当前请求的登录用户（由 JWT 中间件注入）。 */
export interface AuthUser {
  userId: number;
  userName: string;
  nickName: string;
  /** token 绑定的岗位，可为空（用户无在岗岗位时）。 */
  postId: number | null;
}

/** Hono 应用环境变量。 */
export interface AppEnv {
  Variables: {
    currentUser: AuthUser;
  };
}

export type AppContext = Context<AppEnv>;
