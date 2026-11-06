import { createMiddleware } from 'hono/factory';

import type { Perm } from '@cloudhub/types';

import { dbClient } from '../db/index.js';
import type { AppEnv } from '../types/context.js';
import { HttpError } from '../utils/http.js';

/**
 * 功能权限校验：功能权限 = 角色 ∪ 岗位 ∪ 组织，统一从 v_user_permission 读取。
 * 传入多个权限时满足任意一个即可。
 */
export function requirePerm(...required: Perm[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (required.length === 0) {
      await next();
      return;
    }

    const { userId } = c.get('currentUser');
    const rows = await dbClient.query<{ perms: string | null }>(
      `SELECT DISTINCT perms
         FROM v_user_permission
        WHERE user_id = ? AND perms IS NOT NULL AND perms <> ''`,
      [userId],
    );
    const granted = new Set(rows.map((row) => row.perms).filter(Boolean));

    if (!required.some((perm) => granted.has(perm))) {
      throw new HttpError(403, '没有操作权限');
    }

    await next();
  });
}
