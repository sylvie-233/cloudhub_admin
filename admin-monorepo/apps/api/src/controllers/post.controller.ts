import * as postService from '../services/post.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import {
  createPostSchema,
  postQuerySchema,
  updatePostSchema,
} from '../validators/post.js';

/** GET /api/posts?orgId= */
export async function listPosts(c: AppContext): Promise<Response> {
  const query = parseQuery(c, postQuerySchema);
  return success(c, await postService.listPostsByOrg(query.orgId));
}

/** GET /api/posts/:id */
export async function getPost(c: AppContext): Promise<Response> {
  return success(c, await postService.getPostDetail(parseId(c)));
}

/** POST /api/posts */
export async function createPost(c: AppContext): Promise<Response> {
  const input = await parseJson(c, createPostSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await postService.createPost(input, operator), '岗位创建成功');
}

/** PUT /api/posts/:id */
export async function updatePost(c: AppContext): Promise<Response> {
  const input = await parseJson(c, updatePostSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await postService.updatePost(parseId(c), input, operator), '岗位信息已更新');
}

/** DELETE /api/posts/:id */
export async function deletePost(c: AppContext): Promise<Response> {
  const operator = c.get('currentUser').userName;
  await postService.deletePost(parseId(c), operator);
  return success(c, null, '岗位已删除');
}
