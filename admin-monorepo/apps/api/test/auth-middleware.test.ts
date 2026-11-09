import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import { authenticate } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error.js';
import type { AppEnv } from '../src/types/context.js';
import { success } from '../src/utils/http.js';
import { signToken } from '../src/utils/jwt.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

const app = new Hono<AppEnv>();
app.onError(errorHandler);
app.get('/private', authenticate, (c) => success(c, c.get('currentUser')));

interface Body {
  code: number;
  message: string;
  data: unknown;
}

async function call(headers?: Record<string, string>): Promise<{ status: number; body: Body }> {
  const res = await app.request('/private', { headers });
  return { status: res.status, body: (await res.json()) as Body };
}

beforeEach(() => {
  db.queryOne.mockReset();
});

describe('JWT 鉴权中间件', () => {
  it('缺少 Authorization 时返回 401', async () => {
    const { status, body } = await call();

    expect(status).toBe(401);
    expect(body.message).toBe('未登录或登录已过期');
  });

  it('认证方案不是 Bearer 时返回 401', async () => {
    const { status, body } = await call({ Authorization: 'Basic abc' });

    expect(status).toBe(401);
    expect(body.message).toBe('未登录或登录已过期');
  });

  it('token 非法时返回 401', async () => {
    const { status, body } = await call({ Authorization: 'Bearer not-a-token' });

    expect(status).toBe(401);
    expect(body.message).toBe('登录状态已失效，请重新登录');
  });

  it('token 有效时回查用户并注入当前用户', async () => {
    db.queryOne.mockResolvedValueOnce({
      userId: 1,
      userName: 'admin',
      nickName: '超级管理员',
      status: '0',
      delFlag: '0',
    });
    const { token } = await signToken(1, 'admin', 2);

    const { status, body } = await call({ Authorization: `Bearer ${token}` });

    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toEqual({
      userId: 1,
      userName: 'admin',
      nickName: '超级管理员',
      postId: 2,
    });
    expect(db.queryOne.mock.calls[0]?.[1]).toEqual([1]);
  });

  it('用户已删除时返回 401', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    const { token } = await signToken(2, 'ghost', null);

    const { status, body } = await call({ Authorization: `Bearer ${token}` });

    expect(status).toBe(401);
    expect(body.message).toBe('账号不存在或已被删除');
  });

  it('用户已停用时返回 403', async () => {
    db.queryOne.mockResolvedValueOnce({
      userId: 2,
      userName: 'disabled',
      nickName: '停用用户',
      status: '1',
      delFlag: '0',
    });
    const { token } = await signToken(2, 'disabled', null);

    const { status, body } = await call({ Authorization: `Bearer ${token}` });

    expect(status).toBe(403);
    expect(body.message).toBe('账号已停用，请联系管理员');
  });
});
