import { createRoute } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as permController from '../controllers/perm.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  RolePermissionDetailSchema,
  SubjectPermissionDetailSchema,
  errorResponses,
  jsonContent,
  notFoundResponse,
  orgIdParamsSchema,
  postIdParamsSchema,
  roleIdParamsSchema,
  successResponse,
} from '../openapi/models.js';
import { saveMenusSchema, setDataScopeSchema } from '../validators/perm.js';

const router = createApiRouter();

router.use('*', authenticate);

/* ========================= 角色权限 ========================= */

const rolePermissionRoute = createRoute({
  method: 'get',
  path: '/role/{roleId}',
  tags: ['权限'],
  summary: '获取角色权限',
  description: '返回角色已授权的菜单/动作 ID、数据范围与自定义组织范围。',
  middleware: [requirePerm(PERMS.PERM_QUERY)],
  request: { params: roleIdParamsSchema },
  responses: {
    200: successResponse(RolePermissionDetailSchema, '角色权限详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const roleMenusRoute = createRoute({
  method: 'put',
  path: '/role/{roleId}/menus',
  tags: ['权限'],
  summary: '保存角色菜单权限',
  description: '全量替换角色菜单授权；超级管理员角色锁定。',
  middleware: [requirePerm(PERMS.PERM_SAVE)],
  request: {
    params: roleIdParamsSchema,
    body: { content: jsonContent(saveMenusSchema), required: true },
  },
  responses: {
    200: successResponse(RolePermissionDetailSchema, '角色权限已保存'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const roleDataScopeRoute = createRoute({
  method: 'put',
  path: '/role/{roleId}/data-scope',
  tags: ['权限'],
  summary: '保存角色数据范围',
  description: '数据范围仅来源于角色；自定义范围需同时提交 orgIds。',
  middleware: [requirePerm(PERMS.PERM_DATA_SCOPE)],
  request: {
    params: roleIdParamsSchema,
    body: { content: jsonContent(setDataScopeSchema), required: true },
  },
  responses: {
    200: successResponse(RolePermissionDetailSchema, '数据权限已保存'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

/* ========================= 岗位权限 ========================= */

const postPermissionRoute = createRoute({
  method: 'get',
  path: '/post/{postId}',
  tags: ['权限'],
  summary: '获取岗位权限',
  middleware: [requirePerm(PERMS.PERM_QUERY)],
  request: { params: postIdParamsSchema },
  responses: {
    200: successResponse(SubjectPermissionDetailSchema, '岗位权限详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const postMenusRoute = createRoute({
  method: 'put',
  path: '/post/{postId}/menus',
  tags: ['权限'],
  summary: '保存岗位菜单权限',
  description: '岗位权限不经过角色，直接授予在岗用户。',
  middleware: [requirePerm(PERMS.PERM_SAVE)],
  request: {
    params: postIdParamsSchema,
    body: { content: jsonContent(saveMenusSchema), required: true },
  },
  responses: {
    200: successResponse(SubjectPermissionDetailSchema, '岗位权限已保存'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

/* ========================= 组织权限 ========================= */

const orgPermissionRoute = createRoute({
  method: 'get',
  path: '/org/{orgId}',
  tags: ['权限'],
  summary: '获取组织权限',
  middleware: [requirePerm(PERMS.PERM_QUERY)],
  request: { params: orgIdParamsSchema },
  responses: {
    200: successResponse(SubjectPermissionDetailSchema, '组织权限详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const orgMenusRoute = createRoute({
  method: 'put',
  path: '/org/{orgId}/menus',
  tags: ['权限'],
  summary: '保存组织菜单权限',
  description: '组织权限沿组织树向下继承。',
  middleware: [requirePerm(PERMS.PERM_SAVE)],
  request: {
    params: orgIdParamsSchema,
    body: { content: jsonContent(saveMenusSchema), required: true },
  },
  responses: {
    200: successResponse(SubjectPermissionDetailSchema, '组织权限已保存'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(rolePermissionRoute, routeHandler(permController.getRolePermission));
router.openapi(roleMenusRoute, routeHandler(permController.saveRoleMenus));
router.openapi(roleDataScopeRoute, routeHandler(permController.saveRoleDataScope));
router.openapi(postPermissionRoute, routeHandler(permController.getPostPermission));
router.openapi(postMenusRoute, routeHandler(permController.savePostMenus));
router.openapi(orgPermissionRoute, routeHandler(permController.getOrgPermission));
router.openapi(orgMenusRoute, routeHandler(permController.saveOrgMenus));

export default router;
