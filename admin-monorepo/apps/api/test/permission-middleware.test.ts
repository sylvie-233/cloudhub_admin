import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { PERMS } from '@cloudhub/types';

import { dbClient } from '../src/db/index.js';
import { errorHandler } from '../src/middleware/error.js';
import { requirePerm } from '../src/middleware/permission.js';
import type { AppEnv } from '../src/types/context.js';
import { success } from '../src/utils/http.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

const app = new Hono<AppEnv>();
app.onError(errorHandler);
app.use('/perm/*', async (c, next) => {
  c.set('currentUser', { userId: 1, userName: 'admin', nickName: '管理员', postId: null });
  await next();
});
app.get('/perm/one', requirePerm(PERMS.USER_LIST), (c) => success(c, { ok: true }));
app.get(
  '/perm/any',
  requirePerm(PERMS.USER_ADD, PERMS.USER_EDIT),
  (c) => success(c, { ok: true }),
);
app.get('/perm/none', requirePerm(), (c) => success(c, { ok: true }));

interface Body {
  code: number;
  message: string;
  data: unknown;
}

async function call(path: string): Promise<{ status: number; body: Body }> {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as Body };
}

beforeEach(() => {
  db.query.mockReset();
});

describe('功能权限中间件', () => {
  it('命中所需权限时放行', async () => {
    db.query.mockResolvedValueOnce([{ perms: PERMS.USER_LIST }]);

    const { status, body } = await call('/perm/one');

    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(db.query.mock.calls[0]?.[1]).toEqual([1]);
  });

  it('没有所需权限时返回 403', async () => {
    db.query.mockResolvedValueOnce([{ perms: PERMS.USER_ADD }]);

    const { status, body } = await call('/perm/one');

    expect(status).toBe(403);
    expect(body.message).toBe('没有操作权限');
  });

  it('多个权限满足任意一个即可', async () => {
    db.query.mockResolvedValueOnce([{ perms: PERMS.USER_EDIT }]);

    const { status } = await call('/perm/any');

    expect(status).toBe(200);
  });

  it('空权限标识会被忽略', async () => {
    db.query.mockResolvedValueOnce([{ perms: null }, { perms: '' }]);

    const { status, body } = await call('/perm/one');

    expect(status).toBe(403);
    expect(body.message).toBe('没有操作权限');
  });

  it('未声明权限要求时直接放行且不查库', async () => {
    const { status } = await call('/perm/none');

    expect(status).toBe(200);
    expect(db.query).not.toHaveBeenCalled();
  });
});
