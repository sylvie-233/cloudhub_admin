import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ApiResponse } from '@cloudhub/types';

/** 业务异常：由全局错误中间件转换为统一响应。 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** 统一成功响应。 */
export function success(
  c: Context,
  data: unknown,
  message = '操作成功',
  status: ContentfulStatusCode = 200,
): Response {
  const body: ApiResponse<unknown> = { code: 200, message, data };
  return c.body(JSON.stringify(body), status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
}
