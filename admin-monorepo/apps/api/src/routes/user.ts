import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  UserListItemSchema,
  UserPageResultSchema,
  UserPermissionDetailSchema,
  conflictResponse,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import {
  assignRolesSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userQuerySchema,
} from '../validators/user.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['用户'],
  summary: '分页查询用户',
  description: '支持关键字、组织（含下级）、状态筛选，并自动应用当前用户的数据范围。',
  middleware: [requirePerm(PERMS.USER_LIST)],
  request: { query: userQuerySchema },
  responses: {
    200: successResponse(UserPageResultSchema, '用户分页列表'),
    ...errorResponses,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['用户'],
  summary: '新增用户',
  description:
    '必须至少选择一个任职岗位，可同时分配角色；分配角色还需要 system:user:authRole 权限。'
    + '超级管理员角色仅限内置 admin 账号。',
  middleware: [requirePerm(PERMS.USER_ADD)],
  request: {
    body: { content: jsonContent(createUserSchema), required: true },
  },
  responses: {
    200: successResponse(UserListItemSchema, '用户创建成功'),
    ...errorResponses,
    409: conflictResponse,
  },
});

const permissionsRoute = createRoute({
  method: 'get',
  path: '/{id}/permissions',
  tags: ['用户'],
  summary: '查看用户权限',
  description: '返回合并后的菜单/动作权限、数据范围以及各来源明细。',
  middleware: [requirePerm(PERMS.USER_VIEW)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(UserPermissionDetailSchema, '用户权限详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const resetPasswordRoute = createRoute({
  method: 'put',
  path: '/{id}/password',
  tags: ['用户'],
  summary: '重置用户密码',
  middleware: [requirePerm(PERMS.USER_RESET_PWD)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(resetPasswordSchema), required: true },
  },
  responses: {
    200: successResponse(z.null(), '密码已重置'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const assignRolesRoute = createRoute({
  method: 'put',
  path: '/{id}/roles',
  tags: ['用户'],
  summary: '分配用户角色',
  description:
    '全量替换用户角色。内置 admin 必须保留超级管理员角色，超级管理员角色仅限内置 admin 账号。',
  middleware: [requirePerm(PERMS.USER_AUTH_ROLE)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(assignRolesSchema), required: true },
  },
  responses: {
    200: successResponse(UserListItemSchema, '用户角色已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['用户'],
  summary: '获取用户详情',
  middleware: [requirePerm(PERMS.USER_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(UserListItemSchema, '用户详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['用户'],
  summary: '修改用户',
  description:
    '修改角色同样需要 system:user:authRole 权限；内置 admin 必须保留超级管理员角色，'
    + '超级管理员角色仅限内置 admin 账号。',
  middleware: [requirePerm(PERMS.USER_EDIT)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(updateUserSchema), required: true },
  },
  responses: {
    200: successResponse(UserListItemSchema, '用户信息已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['用户'],
  summary: '删除用户',
  description: '内置 admin 账号不可删除。',
  middleware: [requirePerm(PERMS.USER_REMOVE)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.null(), '用户已删除'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(userController.listUsers));
router.openapi(createRouteDef, routeHandler(userController.createUser));
router.openapi(permissionsRoute, routeHandler(userController.getUserPermissions));
router.openapi(resetPasswordRoute, routeHandler(userController.resetPassword));
router.openapi(assignRolesRoute, routeHandler(userController.assignRoles));
router.openapi(detailRoute, routeHandler(userController.getUser));
router.openapi(updateRoute, routeHandler(userController.updateUser));
router.openapi(deleteRoute, routeHandler(userController.deleteUser));

export default router;
