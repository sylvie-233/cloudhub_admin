import { createRoute } from '@hono/zod-openapi';

import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  DashboardStatsSchema,
  errorResponses,
  successResponse,
} from '../openapi/models.js';

const router = createApiRouter();

router.use('*', authenticate);

const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['工作台'],
  summary: '获取工作台统计',
  description: '返回组织、岗位、用户、角色概览，组织人数 Top 8 与最近登录记录。',
  responses: {
    200: successResponse(DashboardStatsSchema, '工作台统计数据'),
    ...errorResponses,
  },
});

router.openapi(getStatsRoute, routeHandler(dashboardController.getDashboardStats));

export default router;
