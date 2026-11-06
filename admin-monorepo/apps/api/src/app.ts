import { Scalar } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { corsOrigins } from './config/env.js';
import { dbClient } from './db/index.js';
import { errorHandler } from './middleware/error.js';
import apiRoutes from './routes/index.js';
import type { AppEnv } from './types/context.js';
import { success } from './utils/http.js';

export const app = new OpenAPIHono<AppEnv>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Disposition'],
    maxAge: 86400,
  }),
);

/** 健康检查：同时探测数据库连通性，便于容器编排使用。 */
app.get('/health', async (c) => {
  try {
    await dbClient.ping();
    return success(c, { status: 'ok', db: 'up' });
  } catch (error) {
    console.error('[api:health] 数据库连接异常', error);
    return c.body(
      JSON.stringify({ code: 503, message: '数据库连接不可用', data: { status: 'error', db: 'down' } }),
      503,
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
  }
});

app.route('/api', apiRoutes);

/** OpenAPI 文档（JSON）与 Scalar API Reference。 */
app.get(
  '/api/docs',
  Scalar({
    url: '/api/openapi.json',
    pageTitle: 'CloudHub Admin API 文档',
  }),
);

app.notFound((c) =>
  c.body(
    JSON.stringify({ code: 404, message: '接口不存在', data: null }),
    404,
    { 'Content-Type': 'application/json; charset=utf-8' },
  ),
);

app.onError(errorHandler);

export default app;
