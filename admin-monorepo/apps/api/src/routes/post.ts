import { createRoute, z } from '@hono/zod-openapi';

import { PERMS } from '@cloudhub/types';

import * as postController from '../controllers/post.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requirePerm } from '../middleware/permission.js';
import { createApiRouter, routeHandler } from '../openapi/router.js';
import {
  PostDetailSchema,
  PostTreeNodeSchema,
  conflictResponse,
  errorResponses,
  idParamsSchema,
  jsonContent,
  notFoundResponse,
  successResponse,
} from '../openapi/models.js';
import {
  createPostSchema,
  postQuerySchema,
  updatePostSchema,
} from '../validators/post.js';

const router = createApiRouter();

router.use('*', authenticate);

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['岗位'],
  summary: '查询组织岗位树',
  description: '返回指定组织下的岗位汇报线树，并附带在岗人数与责任岗位标记。',
  middleware: [requirePerm(PERMS.POST_QUERY)],
  request: { query: postQuerySchema },
  responses: {
    200: successResponse(z.array(PostTreeNodeSchema), '岗位树'),
    ...errorResponses,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['岗位'],
  summary: '新增岗位',
  description:
    '可设置所属组织的责任岗位，设置后会同步更新 orgs.leader_post_id；'
    + '设置责任岗位还需要 system:org:setLeader 权限。',
  middleware: [requirePerm(PERMS.POST_ADD)],
  request: {
    body: { content: jsonContent(createPostSchema), required: true },
  },
  responses: {
    200: successResponse(PostDetailSchema, '岗位创建成功'),
    ...errorResponses,
    409: conflictResponse,
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['岗位'],
  summary: '获取岗位详情',
  middleware: [requirePerm(PERMS.POST_QUERY)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(PostDetailSchema, '岗位详情'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['岗位'],
  summary: '修改岗位',
  description: '变更责任岗位标记还需要 system:org:setLeader 权限。',
  middleware: [requirePerm(PERMS.POST_EDIT)],
  request: {
    params: idParamsSchema,
    body: { content: jsonContent(updatePostSchema), required: true },
  },
  responses: {
    200: successResponse(PostDetailSchema, '岗位信息已更新'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['岗位'],
  summary: '删除岗位',
  description: '岗位下仍有在岗用户时不可删除。',
  middleware: [requirePerm(PERMS.POST_REMOVE)],
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(z.null(), '岗位已删除'),
    ...errorResponses,
    404: notFoundResponse,
  },
});

router.openapi(listRoute, routeHandler(postController.listPosts));
router.openapi(createRouteDef, routeHandler(postController.createPost));
router.openapi(detailRoute, routeHandler(postController.getPost));
router.openapi(updateRoute, routeHandler(postController.updatePost));
router.openapi(deleteRoute, routeHandler(postController.deletePost));

export default router;
