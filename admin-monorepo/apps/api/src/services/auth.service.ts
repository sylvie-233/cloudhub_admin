import type {
  LoginInput,
  LoginPost,
  LoginResult,
  UserProfile,
} from '@cloudhub/types';

import { dbClient } from '../db/index.js';
import type { ClientInfo } from '../utils/client.js';
import { HttpError } from '../utils/http.js';
import { signToken } from '../utils/jwt.js';
import { verifyPassword } from '../utils/password.js';
import { recordLogin } from './log.service.js';
import { getOrgPathMap } from './org.service.js';
import { getUserMenus, getUserPermissionStrings } from './permission.service.js';
import {
  findUserForLogin,
  loadRolesForUsers,
  loadUserBase,
} from './user.service.js';

interface LoginPostRow {
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
  ancestors: string;
  leaderPostId: number | null;
}

async function loadLoginPosts(userId: number): Promise<LoginPost[]> {
  const rows = await dbClient.query<LoginPostRow>(
    `SELECT p.post_id AS postId, p.post_name AS postName, p.org_id AS orgId,
            o.org_name AS orgName, o.ancestors, o.leader_post_id AS leaderPostId
       FROM sys_user_post up
       JOIN sys_post p ON p.post_id = up.post_id AND p.del_flag = '0' AND p.status = '0'
       JOIN sys_org o ON o.org_id = p.org_id AND o.del_flag = '0'
      WHERE up.user_id = ?
      ORDER BY p.post_sort, p.post_id`,
    [userId],
  );

  const pathMap = await getOrgPathMap();

  return rows.map((row) => ({
    postId: row.postId,
    postName: row.postName,
    orgId: row.orgId,
    orgName: row.orgName,
    orgPath: pathMap.get(row.orgId) ?? row.orgName,
    isLeader: row.leaderPostId === row.postId,
  }));
}

async function buildProfile(userId: number, tokenPostId: number | null): Promise<UserProfile> {
  const [user, posts, rolesMap, permissions, menus] = await Promise.all([
    loadUserBase(userId),
    loadLoginPosts(userId),
    loadRolesForUsers([userId]),
    getUserPermissionStrings(userId),
    getUserMenus(userId),
  ]);

  if (!user) {
    throw new HttpError(401, '用户不存在或已被删除');
  }

  const currentPost =
    posts.find((post) => post.postId === tokenPostId) ?? posts[0] ?? null;

  return {
    userId: user.userId,
    userName: user.userName,
    nickName: user.nickName,
    email: user.email,
    phonenumber: user.phonenumber,
    sex: user.sex,
    status: user.status,
    posts,
    roles: rolesMap.get(userId) ?? [],
    permissions,
    menus,
    currentPost,
  };
}

/** 记录失败日志后抛出统一错误，保证失败尝试也可追溯。 */
async function failLogin(
  userName: string,
  message: string,
  client: ClientInfo,
  httpStatus = 401,
): Promise<never> {
  await recordLogin({
    userName,
    postName: '',
    ipaddr: client.ipaddr,
    loginLocation: client.loginLocation,
    browser: client.browser,
    os: client.os,
    status: '1',
    msg: message,
  });
  throw new HttpError(httpStatus, message);
}

/** 登录：校验账号密码与岗位，成功后签发 JWT 并记录日志。 */
export async function login(
  input: LoginInput,
  client: ClientInfo,
): Promise<LoginResult> {
  const user = await findUserForLogin(input.userName);

  if (!user || user.delFlag === '2') {
    return failLogin(input.userName, '账号或密码错误', client);
  }
  if (user.status === '1') {
    return failLogin(input.userName, '账号已停用，请联系管理员', client);
  }
  if (!(await verifyPassword(input.password, user.password))) {
    return failLogin(input.userName, '账号或密码错误', client);
  }

  const posts = await loadLoginPosts(user.userId);
  let currentPost: LoginPost | null = null;

  if (input.postId) {
    currentPost = posts.find((post) => post.postId === input.postId) ?? null;
    if (!currentPost) {
      return failLogin(input.userName, '所选岗位不存在或已停用', client);
    }
  } else {
    currentPost = posts[0] ?? null;
  }

  const { token, expiresIn } = await signToken(
    user.userId,
    user.userName,
    currentPost?.postId ?? null,
  );

  await recordLogin({
    userName: user.userName,
    postName: currentPost?.postName ?? '',
    ipaddr: client.ipaddr,
    loginLocation: client.loginLocation,
    browser: client.browser,
    os: client.os,
    status: '0',
    msg: '登录成功',
  });

  return {
    token,
    tokenType: 'Bearer',
    expiresIn,
    profile: await buildProfile(user.userId, currentPost?.postId ?? null),
  };
}

/** 当前登录用户信息。 */
export async function getProfile(
  userId: number,
  tokenPostId: number | null,
): Promise<UserProfile> {
  return buildProfile(userId, tokenPostId);
}

/** 续签 token：沿用当前岗位，重新计算有效期。 */
export async function refresh(
  userId: number,
  userName: string,
  tokenPostId: number | null,
): Promise<LoginResult> {
  const { token, expiresIn } = await signToken(userId, userName, tokenPostId);
  return {
    token,
    tokenType: 'Bearer',
    expiresIn,
    profile: await buildProfile(userId, tokenPostId),
  };
}
