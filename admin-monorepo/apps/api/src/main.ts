import { serve } from '@hono/node-server';

import app from './app.js';
import { env } from './config/env.js';
import { dbClient } from './db/index.js';

async function bootstrap(): Promise<void> {
  // 启动前先确认数据库可用，避免服务可访问但所有接口报错的假健康状态
  await dbClient.ping();

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
      hostname: env.HOST,
    },
    (info) => {
      console.log(`[api] 服务已启动：http://${info.address}:${info.port}`);
      console.log(`[api] 接口前缀：/api，健康检查：/health`);
      console.log(`[api] API 文档：/api/docs，OpenAPI JSON：/api/openapi.json`);
    },
  );

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) {
      return;
    }
    closing = true;
    console.log(`[api] 收到 ${signal}，正在关闭服务...`);

    server.close(() => {
      void dbClient
        .close()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          console.error('[api] 关闭数据库连接失败', error);
          process.exit(1);
        });
    });

    // 兜底：10 秒内仍未关闭则强制退出
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('[api] 启动失败：', error);
  process.exit(1);
});
