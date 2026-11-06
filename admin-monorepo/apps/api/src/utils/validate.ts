import type { Context } from 'hono';
import type { ZodError, ZodType } from 'zod';

import { HttpError } from './http.js';

/** 将 Zod 错误压缩为一条中文提示。 */
export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return '参数校验失败';
  }
  const path = issue.path.join('.');
  return path ? `${path}：${issue.message}` : issue.message;
}

/** 解析请求体 JSON，并按 schema 校验。 */
export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, '请求体必须是合法的 JSON');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(400, formatZodError(result.error));
  }
  return result.data;
}

/** 解析 query string，并按 schema 校验。 */
export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new HttpError(400, formatZodError(result.error));
  }
  return result.data;
}

/** 解析路径参数中的 ID。 */
export function parseId(c: Context, name = 'id'): number {
  const value = Number(c.req.param(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `${name} 必须是正整数`);
  }
  return value;
}
