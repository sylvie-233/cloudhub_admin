import { createRoute, z } from '@hono/zod-openapi';

import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  LoginResultSchema,
  UserProfileSchema,
  errorResponses,
  jsonContent,
  successResponse,
} from '../openapi/models.js';
import { loginSchema } from '../validators/auth.js';

const router = createApiRouter();

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['认证'],
  summary: '账号登录',
  description: '校验账号、密码与岗位，成功后签发 JWT 并记录登录日志。',
  security: [],
  request: {
    body: {
      content: jsonContent(loginSchema),
      required: true,
    },
  },
  responses: {
    200: successResponse(LoginResultSchema, '登录成功'),
    ...errorResponses,
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['认证'],
  summary: '退出登录',
  description: 'JWT 为无状态令牌，登出由客户端丢弃令牌完成。',
  middleware: [authenticate],
  responses: {
    200: successResponse(z.null(), '已退出登录'),
    ...errorResponses,
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['认证'],
  summary: '续期访问令牌',
  description: '沿用当前 token 绑定的岗位重新签发 JWT。',
  middleware: [authenticate],
  responses: {
    200: successResponse(LoginResultSchema, '登录状态已续期'),
    ...errorResponses,
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['认证'],
  summary: '获取当前登录用户信息',
  description: '返回用户资料、岗位、角色、合并后的权限标识与菜单树。',
  middleware: [authenticate],
  responses: {
    200: successResponse(UserProfileSchema, '当前用户信息'),
    ...errorResponses,
  },
});

router.openapi(loginRoute, routeHandler(authController.login));
router.openapi(logoutRoute, routeHandler(authController.logout));
router.openapi(refreshRoute, routeHandler(authController.refresh));
router.openapi(meRoute, routeHandler(authController.me));

export default router;
