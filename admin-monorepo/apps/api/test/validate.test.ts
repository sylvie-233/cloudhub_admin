import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorHandler } from '../src/middleware/error.js';
import type { ApiResponse } from '@cloudhub/types';
import { success } from '../src/utils/http.js';
import { parseId, parseJson, parseQuery } from '../src/utils/validate.js';

interface TestBody {
  code: number;
  message: string;
  data: unknown;
}

const app = new Hono();
app.onError(errorHandler);

app.get('/id/:id', (c) => success(c, { id: parseId(c) }));
app.get('/custom-id/:orgId', (c) => success(c, { id: parseId(c, 'orgId') }));
app.get('/query', (c) =>
  success(c, parseQuery(c, z.object({ page: z.coerce.number().int().min(1).default(1) }))),
);
app.post('/json', async (c) =>
  success(c, await parseJson(c, z.object({ name: z.string().min(1) }))),
);

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: TestBody }> {
  const res = await app.request(path, init);
  return { status: res.status, body: (await res.json()) as TestBody };
}

describe('请求参数解析', () => {
  it('路径参数转换为正整数', async () => {
    const { status, body } = await call('/id/12');

    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toEqual({ id: 12 });
  });

  it('支持自定义路径参数名', async () => {
    const { body } = await call('/custom-id/8');

    expect(body.data).toEqual({ id: 8 });
  });

  it('非法路径参数返回 400', async () => {
    for (const value of ['0', '-1', 'abc', '1.5']) {
      const { status, body } = await call(`/id/${value}`);

      expect(status).toBe(400);
      expect(body.code).toBe(400);
      expect(body.message).toBe('id 必须是正整数');
    }
  });

  it('query 参数按 schema 归一化', async () => {
    const { body } = await call('/query?page=3');

    expect(body.data).toEqual({ page: 3 });
  });

  it('query 参数非法时返回 400 并带字段名', async () => {
    const { status, body } = await call('/query?page=abc');

    expect(status).toBe(400);
    expect(body.message).toContain('page');
  });

  it('请求体不是合法 JSON 时返回 400', async () => {
    const { status, body } = await call('/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    expect(status).toBe(400);
    expect(body.message).toBe('请求体必须是合法的 JSON');
  });

  it('请求体不符合 schema 时返回 400', async () => {
    const { status, body } = await call('/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(status).toBe(400);
    expect(body.message).toContain('name');
  });

  it('解析成功时返回统一响应结构', async () => {
    const res = await app.request('/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '云枢' }),
    });
    const body = (await res.json()) as ApiResponse<{ name: string }>;

    expect(body).toEqual({ code: 200, message: '操作成功', data: { name: '云枢' } });
  });
});
