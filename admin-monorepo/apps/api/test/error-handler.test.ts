import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorHandler } from '../src/middleware/error.js';
import { HttpError } from '../src/utils/http.js';

interface ErrorBody {
  code: number;
  message: string;
  data: null;
}

const nameSchema = z.object({ name: z.string().min(1) });

const app = new Hono();
app.onError(errorHandler);

app.get('/http-error', () => {
  throw new HttpError(403, '没有操作权限');
});

app.get('/zod-error', () => {
  const result = nameSchema.safeParse({});
  if (!result.success) {
    throw result.error;
  }
  return new Response('unreachable');
});

app.get('/http-exception', () => {
  throw new HTTPException(401, { message: '未授权' });
});

function mysqlError(code: string): Error {
  return Object.assign(new Error(`mysql error ${code}`), { code });
}

app.get('/dup-entry', () => {
  throw mysqlError('ER_DUP_ENTRY');
});
app.get('/no-table', () => {
  throw mysqlError('ER_NO_SUCH_TABLE');
});
app.get('/conn-refused', () => {
  throw mysqlError('ECONNREFUSED');
});
app.get('/unknown', () => {
  throw new Error('内部 SQL 细节不应暴露');
});

async function call(path: string): Promise<{ status: number; body: ErrorBody }> {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as ErrorBody };
}

describe('全局错误处理', () => {
  it('业务异常保留状态码与中文提示', async () => {
    const { status, body } = await call('/http-error');

    expect(status).toBe(403);
    expect(body).toEqual({ code: 403, message: '没有操作权限', data: null });
  });

  it('ZodError 转为 400 并压缩首个错误', async () => {
    const { status, body } = await call('/zod-error');

    expect(status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.message).toContain('name');
    expect(body.data).toBeNull();
  });

  it('HTTPException 保留自身状态码', async () => {
    const { status, body } = await call('/http-exception');

    expect(status).toBe(401);
    expect(body.message).toBe('未授权');
  });

  it('重复键转为 409', async () => {
    const { status, body } = await call('/dup-entry');

    expect(status).toBe(409);
    expect(body.message).toBe('数据已存在，请检查编码或账号是否重复');
  });

  it('表缺失转为中文 500', async () => {
    const { status, body } = await call('/no-table');

    expect(status).toBe(500);
    expect(body.message).toBe('数据库表不存在，请先执行 doc/cloudhub_admin_v1.sql 初始化');
  });

  it('数据库连接失败转为 503', async () => {
    const { status, body } = await call('/conn-refused');

    expect(status).toBe(503);
    expect(body.message).toBe('数据库连接不可用，请检查 MySQL 是否已启动');
  });

  it('未知异常返回通用提示且不泄露原始信息', async () => {
    const { status, body } = await call('/unknown');

    expect(status).toBe(500);
    expect(body).toEqual({ code: 500, message: '服务器内部错误', data: null });
  });
});
