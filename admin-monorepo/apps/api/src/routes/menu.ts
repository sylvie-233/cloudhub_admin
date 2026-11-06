import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as menuController from '../controllers/menu.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  MenuRowSchema,
  MenuSchema,
  MenuTreeNodeSchema,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import {
  createMenuSchema,
  menuQuerySchema,
  updateMenuSchema,
} from '../validators/menu.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['菜单'],
  summary: '查询菜单列表',
  description: '默认按树层级展开为扁平列表，支持关键字、类型与状态筛选。',
  middleware: [requirePerm(PERMS.MENU_LIST, PERMS.PERM_QUERY)],
  request: { query: menuQuerySchema },
  responses: {
    200: successResponse(z.array(MenuRowSchema), '菜单列表'),
    ...errorResponses,
  },
});

const treeRoute = createRoute({
  method: 'get',
  path: '/tree',
  tags: ['菜单'],
  summary: '查询菜单树',
  middleware: [requirePerm(PERMS.MENU_LIST, PERMS.PERM_QUERY)],
  responses: {
    200: successResponse(z.array(MenuTreeNodeSchema), '菜单树'),
    ...errorResponses,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['菜单'],
  summary: '新增菜单',
  description: '新增后默认授权给超级管理员角色。',
  middleware: [requirePerm(PERMS.MENU_ADD)],
  request: {
    body: { content: jsonContent(createMenuSchema), required: true },
  },
  responses: {
    200: successResponse(MenuSchema, '菜单创建成功，已默认授权给超级管理员'),
    ...errorResponses,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['菜单'],
  summary: '获取菜单详情',
  middleware: [requirePerm(PERMS.MENU_QUERY, PERMS.PERM_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(MenuSchema, '菜单详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['菜单'],
  summary: '修改菜单',
  description: '不能移动到自身下级；动作类型不能作为父节点。',
  middleware: [requirePerm(PERMS.MENU_EDIT)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(updateMenuSchema), required: true },
  },
  responses: {
    200: successResponse(MenuSchema, '菜单已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['菜单'],
  summary: '删除菜单',
  description: '存在子节点时不可删除；删除会同步清理角色、岗位、组织的授权记录。',
  middleware: [requirePerm(PERMS.MENU_REMOVE)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.null(), '菜单已删除，相关授权已同步清理'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(menuController.listMenus));
router.openapi(treeRoute, routeHandler(menuController.getMenuTree));
router.openapi(createRouteDef, routeHandler(menuController.createMenu));
router.openapi(detailRoute, routeHandler(menuController.getMenu));
router.openapi(updateRoute, routeHandler(menuController.updateMenu));
router.openapi(deleteRoute, routeHandler(menuController.deleteMenu));

export default router;
