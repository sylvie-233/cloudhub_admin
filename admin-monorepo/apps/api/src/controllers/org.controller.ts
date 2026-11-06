import * as orgService from '../services/org.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';
import { parseId, parseJson, parseQuery } from '../utils/validate.js';
import {
  createOrgSchema,
  orgQuerySchema,
  orgUserQuerySchema,
  setLeaderSchema,
  updateOrgSchema,
} from '../validators/org.js';

/** GET /api/orgs */
export async function listOrgs(c: AppContext): Promise<Response> {
  const query = parseQuery(c, orgQuerySchema);
  return success(c, await orgService.listOrgTree(query));
}

/** GET /api/orgs/:id */
export async function getOrg(c: AppContext): Promise<Response> {
  return success(c, await orgService.getOrgDetail(parseId(c)));
}

/** POST /api/orgs */
export async function createOrg(c: AppContext): Promise<Response> {
  const input = await parseJson(c, createOrgSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await orgService.createOrg(input, operator), '组织创建成功');
}

/** PUT /api/orgs/:id */
export async function updateOrg(c: AppContext): Promise<Response> {
  const input = await parseJson(c, updateOrgSchema);
  const operator = c.get('currentUser').userName;
  return success(c, await orgService.updateOrg(parseId(c), input, operator), '组织信息已更新');
}

/** DELETE /api/orgs/:id */
export async function deleteOrg(c: AppContext): Promise<Response> {
  const operator = c.get('currentUser').userName;
  await orgService.deleteOrg(parseId(c), operator);
  return success(c, null, '组织已删除');
}

/** PUT /api/orgs/:id/leader */
export async function setLeader(c: AppContext): Promise<Response> {
  const input = await parseJson(c, setLeaderSchema);
  const operator = c.get('currentUser').userName;
  return success(
    c,
    await orgService.setOrgLeader(parseId(c), input.postId, operator),
    input.postId ? '责任岗位已设置' : '责任岗位已清空',
  );
}

/** GET /api/orgs/:id/users */
export async function listOrgUsers(c: AppContext): Promise<Response> {
  const query = parseQuery(c, orgUserQuerySchema);
  const { userId } = c.get('currentUser');
  return success(c, await orgService.listOrgUsers(parseId(c), query, userId));
}
