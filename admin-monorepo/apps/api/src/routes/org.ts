import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as orgController from '../controllers/org.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  LeaderPostResultSchema,
  OrgDetailSchema,
  OrgTreeNodeSchema,
  OrgUserPageResultSchema,
  conflictResponse,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import {
  createOrgSchema,
  orgQuerySchema,
  orgUserQuerySchema,
  setLeaderSchema,
  updateOrgSchema,
} from '../validators/org.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['组织'],
  summary: '查询组织树',
  description: '返回完整组织树，支持按名称/编码关键字与状态筛选。',
  middleware: [requirePerm(PERMS.ORG_LIST)],
  request: { query: orgQuerySchema },
  responses: {
    200: successResponse(z.array(OrgTreeNodeSchema), '组织树'),
    ...errorResponses,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['组织'],
  summary: '新增组织',
  description: '自动生成组织编码、默认岗位与祖级路径，组织树最多 9 级。',
  middleware: [requirePerm(PERMS.ORG_ADD)],
  request: {
    body: { content: jsonContent(createOrgSchema), required: true },
  },
  responses: {
    200: successResponse(OrgDetailSchema, '组织创建成功'),
    ...errorResponses,
    409: conflictResponse,
  },
});

const usersRoute = createRoute({
  method: 'get',
  path: '/{id}/users',
  tags: ['组织'],
  summary: '查询组织在岗用户',
  description: '支持包含下级组织、按岗位筛选，并应用当前用户的数据范围。',
  middleware: [requirePerm(PERMS.ORG_QUERY)],
  request: { params: idParamsSchema, query: orgUserQuerySchema },
  responses: {
    200: successResponse(OrgUserPageResultSchema, '组织在岗用户'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const leaderRoute = createRoute({
  method: 'put',
  path: '/{id}/leader',
  tags: ['组织'],
  summary: '设置责任岗位',
  description: '责任岗位必须属于当前组织；传 null 表示清空。',
  middleware: [requirePerm(PERMS.ORG_SET_LEADER)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(setLeaderSchema), required: true },
  },
  responses: {
    200: successResponse(LeaderPostResultSchema, '责任岗位已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['组织'],
  summary: '获取组织详情',
  description: '返回组织基础信息、岗位列表与在岗人数。',
  middleware: [requirePerm(PERMS.ORG_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(OrgDetailSchema, '组织详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['组织'],
  summary: '修改组织',
  description: '修改上级组织时会同步重建下级组织的祖级路径。',
  middleware: [requirePerm(PERMS.ORG_EDIT)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(updateOrgSchema), required: true },
  },
  responses: {
    200: successResponse(OrgDetailSchema, '组织信息已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['组织'],
  summary: '删除组织',
  description: '存在下级组织或岗位时不可删除。',
  middleware: [requirePerm(PERMS.ORG_REMOVE)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.null(), '组织已删除'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(orgController.listOrgs));
router.openapi(createRouteDef, routeHandler(orgController.createOrg));
router.openapi(usersRoute, routeHandler(orgController.listOrgUsers));
router.openapi(leaderRoute, routeHandler(orgController.setLeader));
router.openapi(detailRoute, routeHandler(orgController.getOrg));
router.openapi(updateRoute, routeHandler(orgController.updateOrg));
router.openapi(deleteRoute, routeHandler(orgController.deleteOrg));

export default router;
