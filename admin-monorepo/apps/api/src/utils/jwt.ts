import { sign, verify } from 'hono/jwt';

import type { TokenPayload } from '@cloudhub/types';

import { env } from '../config/env.js';

/** 签发 JWT。 */
export async function signToken(
  userId: number,
  userName: string,
  postId: number | null,
): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = env.JWT_EXPIRES_IN;
  const payload: Record<string, unknown> = {
    userId,
    userName,
    postId,
    iat: now,
    exp: now + expiresIn,
  };
  const token = await sign(payload, env.JWT_SECRET, 'HS256');
  return { token, expiresIn };
}

/** 校验 JWT；失败返回 null，由调用方决定错误响应。 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256');
    const userId = Number(payload['userId']);
    const userName = payload['userName'];
    const rawPostId = payload['postId'];
    if (!Number.isInteger(userId) || userId <= 0 || typeof userName !== 'string') {
      return null;
    }
    const postId =
      typeof rawPostId === 'number' && Number.isInteger(rawPostId) ? rawPostId : null;
    return {
      userId,
      userName,
      postId,
      iat: typeof payload['iat'] === 'number' ? payload['iat'] : undefined,
      exp: typeof payload['exp'] === 'number' ? payload['exp'] : undefined,
    };
  } catch {
    return null;
  }
}
