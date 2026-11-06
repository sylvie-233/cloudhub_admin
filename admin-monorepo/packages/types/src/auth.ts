import type { DataScope, GrantSource, MenuType, Sex, Status } from './common.js';

/** 登录请求。postId 可选，多岗用户可指定本次登录使用的岗位。 */
export interface LoginInput {
  userName: string;
  password: string;
  postId?: number;
}

/** 登录后返回的岗位信息（含组织路径）。 */
export interface LoginPost {
  postId: number;
  postName: string;
  orgId: number;
  orgName: string;
  orgPath: string;
  isLeader: boolean;
}

/** 登录后返回的角色信息。 */
export interface LoginRole {
  roleId: number;
  roleName: string;
  roleKey: string;
  dataScope: DataScope;
}

/** 前端可用的菜单节点（仅 M / C）。 */
export interface UserMenuNode {
  menuId: number;
  menuName: string;
  parentId: number;
  orderNum: number;
  path: string;
  component: string | null;
  menuType: MenuType;
  status: Status;
  perms: string | null;
  icon: string;
  children: UserMenuNode[];
}

/** 当前登录用户信息。 */
export interface UserProfile {
  userId: number;
  userName: string;
  nickName: string;
  email: string;
  phonenumber: string;
  sex: Sex;
  status: Status;
  posts: LoginPost[];
  roles: LoginRole[];
  /** 合并后的权限标识（角色 ∪ 岗位 ∪ 组织）。 */
  permissions: string[];
  /** 合并后的可访问菜单树（M / C）。 */
  menus: UserMenuNode[];
  /** 当前 token 绑定的岗位，单岗或未指定时取第一个岗位。 */
  currentPost: LoginPost | null;
}

/** 登录响应。 */
export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  /** 有效期（秒）。 */
  expiresIn: number;
  profile: UserProfile;
}

/** 权限来源明细。 */
export interface PermissionSource {
  /** 前端 tab key：role:<id> / post / org。 */
  key: string;
  type: GrantSource;
  /** 角色来源为角色 ID；岗位/组织聚合来源为 0。 */
  sourceId: number;
  name: string;
  sub: string;
  menuIds: number[];
}

/** 用户权限查看结果。 */
export interface UserPermissionDetail {
  userId: number;
  userName: string;
  nickName: string;
  /** 合并后的菜单/动作 ID。 */
  menuIds: number[];
  sources: PermissionSource[];
  dataScope: DataScope;
  dataScopeOrgIds: number[];
}

/** JWT 载荷（后端签发，共享给前端仅用于类型描述）。 */
export interface TokenPayload {
  userId: number;
  userName: string;
  postId: number | null;
  iat?: number;
  exp?: number;
}
