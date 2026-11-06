import { OpenAPIHono } from '@hono/zod-openapi';
import type { Handler } from 'hono';

import type { AppContext, AppEnv } from '../types/context.js';
import { formatZodError } from '../utils/validate.js';

/**
 * 创建支持 OpenAPI 的路由实例。
 *
 * 统一把 Zod 校验失败转换为项目约定的错误响应，
 * 保证文档接口与业务接口的错误结构一致。
 */
/**
 * 控制器统一返回原生 Response，这里放宽为 Hono Handler 类型，
 * 避免 OpenAPI 路由因响应类型推断而互相约束。
 */
export function routeHandler(
  handler: (c: AppContext) => Promise<Response> | Response,
): Handler<AppEnv> {
  return handler as Handler<AppEnv>;
}

export function createApiRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.body(
          JSON.stringify({ code: 400, message: formatZodError(result.error), data: null }),
          400,
          { 'Content-Type': 'application/json; charset=utf-8' },
        );
      }
    },
  });
}
