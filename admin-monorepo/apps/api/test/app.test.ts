import type { OpenAPIHono } from '@hono/zod-openapi';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import type { AppEnv } from '../src/types/context.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

let app: OpenAPIHono<AppEnv>;

beforeAll(async () => {
  // 动态导入，确保上面的 db mock 已生效
  ({ app } = await import('../src/app.js'));
});

beforeEach(() => {
  db.query.mockReset();
  db.queryOne.mockReset();
  db.execute.mockReset();
  db.ping.mockReset();
  db.transaction.mockReset();
});

interface Body {
  code: number;
  message: string;
  data: unknown;
}

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Body }> {
  const res = await app.request(path, init);
  return { status: res.status, body: (await res.json()) as Body };
}

describe('健康检查', () => {
  it('数据库可用时返回 ok', async () => {
    db.ping.mockResolvedValueOnce(undefined);

    const { status, body } = await call('/health');

    expect(status).toBe(200);
    expect(body).toEqual({ code: 200, message: '操作成功', data: { status: 'ok', db: 'up' } });
  });

  it('数据库不可用时返回 503', async () => {
    db.ping.mockRejectedValueOnce(new Error('connect refused'));

    const { status, body } = await call('/health');

    expect(status).toBe(503);
    expect(body).toMatchObject({
      code: 503,
      message: '数据库连接不可用',
      data: { status: 'error', db: 'down' },
    });
  });
});

describe('OpenAPI 文档', () => {
  it('输出 3.1.0 文档并提供登录接口', async () => {
    const res = await app.request('/api/openapi.json');

    expect(res.status).toBe(200);
    const document = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(document.openapi).toBe('3.1.0');
    expect(document.paths['/auth/login']).toBeDefined();
    expect(db.ping).not.toHaveBeenCalled();
  });
});

describe('接口约定', () => {
  it('未携带 token 访问受保护接口返回 401', async () => {
    const { status, body } = await call('/api/users');

    expect(status).toBe(401);
    expect(body.message).toBe('未登录或登录已过期');
  });

  it('不存在的接口返回统一的 404 结构', async () => {
    const { status, body } = await call('/api/not-exists');

    expect(status).toBe(404);
    expect(body).toEqual({ code: 404, message: '接口不存在', data: null });
  });

  it('登录入参缺失时由 OpenAPI 校验返回 400', async () => {
    const { status, body } = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });

    expect(status).toBe(400);
    expect(body.code).toBe(400);
    // 字段缺失先触发类型校验，提示由 formatZodError 带上字段名
    expect(body.message).toContain('userName');
    expect(body.data).toBeNull();
  });

  it('账号不存在时记录失败日志并返回 401', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    db.execute.mockResolvedValueOnce({ affectedRows: 1 });

    const { status, body } = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
      body: JSON.stringify({ userName: 'ghost', password: 'whatever' }),
    });

    expect(status).toBe(401);
    expect(body.message).toBe('账号或密码错误');
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(['ghost', '127.0.0.1', '内网', '1', '账号或密码错误']),
    );
  });
});
