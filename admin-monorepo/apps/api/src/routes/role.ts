import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as roleController from '../controllers/role.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  RoleDetailSchema,
  RoleListItemSchema,
  RoleUserItemSchema,
  conflictResponse,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import {
  assignRoleUsersSchema,
  createRoleSchema,
  roleQuerySchema,
  updateRoleSchema,
} from '../validators/role.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['角色'],
  summary: '查询角色列表',
  middleware: [requirePerm(PERMS.ROLE_LIST, PERMS.PERM_QUERY)],
  request: { query: roleQuerySchema },
  responses: {
    200: successResponse(z.array(RoleListItemSchema), '角色列表'),
    ...errorResponses,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['角色'],
  summary: '新增角色',
  middleware: [requirePerm(PERMS.ROLE_ADD)],
  request: {
    body: { content: jsonContent(createRoleSchema), required: true },
  },
  responses: {
    200: successResponse(RoleDetailSchema, '角色创建成功，请配置菜单权限'),
    ...errorResponses,
    409: conflictResponse,
  },
});

const usersRoute = createRoute({
  method: 'get',
  path: '/{id}/users',
  tags: ['角色'],
  summary: '查询角色成员',
  middleware: [requirePerm(PERMS.ROLE_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.array(RoleUserItemSchema), '角色成员'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const assignUsersRoute = createRoute({
  method: 'put',
  path: '/{id}/users',
  tags: ['角色'],
  summary: '设置角色成员',
  description: '全量替换角色成员；超级管理员角色必须保留内置 admin 用户。',
  middleware: [requirePerm(PERMS.ROLE_AUTH_USER)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(assignRoleUsersSchema), required: true },
  },
  responses: {
    200: successResponse(z.array(RoleUserItemSchema), '角色成员已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['角色'],
  summary: '获取角色详情',
  middleware: [requirePerm(PERMS.ROLE_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(RoleDetailSchema, '角色详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['角色'],
  summary: '修改角色',
  description: '超级管理员的启用状态与数据范围锁定。',
  middleware: [requirePerm(PERMS.ROLE_EDIT)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(updateRoleSchema), required: true },
  },
  responses: {
    200: successResponse(RoleDetailSchema, '角色已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['角色'],
  summary: '删除角色',
  description: '内置角色或仍有用户的角色不可删除。',
  middleware: [requirePerm(PERMS.ROLE_REMOVE)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.null(), '角色已删除'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(roleController.listRoles));
router.openapi(createRouteDef, routeHandler(roleController.createRole));
router.openapi(usersRoute, routeHandler(roleController.listRoleUsers));
router.openapi(assignUsersRoute, routeHandler(roleController.assignRoleUsers));
router.openapi(detailRoute, routeHandler(roleController.getRole));
router.openapi(updateRoute, routeHandler(roleController.updateRole));
router.openapi(deleteRoute, routeHandler(roleController.deleteRole));

export default router;
