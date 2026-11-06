import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as logController from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  AffectedResultSchema,
  LogininforPageResultSchema,
  LogininforSchema,
  LogininforStatsSchema,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import { deleteLogsSchema, logininforQuerySchema } from '../validators/log.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/logininfor',
  tags: ['登录日志'],
  summary: '分页查询登录日志',
  description: '支持关键字、状态、最近 N 天或时间区间筛选。',
  middleware: [requirePerm(PERMS.LOGININFOR_LIST)],
  request: { query: logininforQuerySchema },
  responses: {
    200: successResponse(LogininforPageResultSchema, '登录日志分页列表'),
    ...errorResponses,
  },
});

const statsRoute = createRoute({
  method: 'get',
  path: '/logininfor/stats',
  tags: ['登录日志'],
  summary: '登录日志概览',
  description: '返回今日登录总数、成功/失败数以及近 7 天活跃账号数。',
  middleware: [requirePerm(PERMS.LOGININFOR_LIST)],
  responses: {
    200: successResponse(LogininforStatsSchema, '登录日志统计'),
    ...errorResponses,
  },
});

const exportRoute = createRoute({
  method: 'get',
  path: '/logininfor/export',
  tags: ['登录日志'],
  summary: '导出登录日志',
  description: '按当前筛选条件导出 CSV，最多 10000 条。',
  middleware: [requirePerm(PERMS.LOGININFOR_EXPORT)],
  request: { query: logininforQuerySchema },
  responses: {
    200: {
      content: {
        'text/csv': {
          schema: z.string().openapi({ description: 'UTF-8 编码的 CSV 文件内容' }),
        },
      },
      description: 'CSV 文件',
    },
    ...errorResponses,
  },
});

const cleanRoute = createRoute({
  method: 'delete',
  path: '/logininfor/clean',
  tags: ['登录日志'],
  summary: '清空登录日志',
  middleware: [requirePerm(PERMS.LOGININFOR_CLEAN)],
  responses: {
    200: successResponse(AffectedResultSchema, '已清空登录日志'),
    ...errorResponses,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/logininfor',
  tags: ['登录日志'],
  summary: '批量删除登录日志',
  middleware: [requirePerm(PERMS.LOGININFOR_REMOVE)],
  request: {
    body: { content: jsonContent(deleteLogsSchema), required: true },
  },
  responses: {
    200: successResponse(AffectedResultSchema, '已删除登录日志'),
    ...errorResponses,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/logininfor/{id}',
  tags: ['登录日志'],
  summary: '获取登录日志详情',
  middleware: [requirePerm(PERMS.LOGININFOR_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(LogininforSchema, '登录日志详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(logController.listLogininfors));
router.openapi(statsRoute, routeHandler(logController.getLogininforStats));
router.openapi(exportRoute, routeHandler(logController.exportLogininfors));
router.openapi(cleanRoute, routeHandler(logController.cleanLogininfors));
router.openapi(deleteRoute, routeHandler(logController.deleteLogininfors));
router.openapi(detailRoute, routeHandler(logController.getLogininfor));

export default router;
