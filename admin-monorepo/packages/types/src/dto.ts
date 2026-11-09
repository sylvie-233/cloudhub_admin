import type { LoginPost, LoginRole } from './auth.js';
import type { DataScope, MenuType, PageQuery, Sex, Status } from './common.js';
import type { Logininfor, Org, Post, Role, User } from './entities.js';

/* ========================= 用户 ========================= */

/** 用户列表项。 */
export interface UserListItem extends User {
  posts: LoginPost[];
  roles: LoginRole[];
  /** 岗位直授的菜单/动作数量。 */
  postPermCount: number;
  /** 组织直授的菜单/动作数量。 */
  orgPermCount: number;
}

export interface UserQuery extends PageQuery {
  keyword?: string;
  orgId?: number;
  /** 是否包含下级组织，默认 true。 */
  includeSub?: boolean;
  status?: Status;
}

export interface CreateUserInput {
  userName: string;
  nickName: string;
  password?: string;
  email?: string;
  phonenumber?: string;
  sex?: Sex;
  status?: Status;
  postIds: number[];
  roleIds?: number[];
}

export interface UpdateUserInput {
  nickName?: string;
  email?: string;
  phonenumber?: string;
  sex?: Sex;
  status?: Status;
  postIds?: number[];
  roleIds?: number[];
}

export interface ResetPasswordInput {
  password: string;
}

export interface AssignRolesInput {
  roleIds: number[];
}

/* ========================= 组织 ========================= */

export interface OrgQuery {
  keyword?: string;
  status?: Status;
}

export interface CreateOrgInput {
  parentId: number;
  orgName: string;
  orgCode?: string;
  orderNum?: number;
  status?: Status;
}

export interface UpdateOrgInput {
  parentId?: number;
  orgName?: string;
  orgCode?: string;
  orderNum?: number;
  status?: Status;
}

export interface SetLeaderInput {
  /** 责任岗位 ID；传 null 表示清空。 */
  postId: number | null;
}

export interface OrgDetail extends Org {
  posts: Post[];
  headcount: number;
}

/** 组织管理页右侧的在岗用户行。 */
export interface OrgUserItem extends User {
  posts: LoginPost[];
}

/* ========================= 岗位 ========================= */

export interface PostQuery {
  orgId: number;
}

export interface CreatePostInput {
  orgId: number;
  parentId?: number;
  postName: string;
  postCode?: string;
  postSort?: number;
  status?: Status;
  /** 是否设为所属组织的责任岗位。 */
  isLeader?: boolean;
}

export interface UpdatePostInput {
  orgId?: number;
  parentId?: number;
  postName?: string;
  postCode?: string;
  postSort?: number;
  status?: Status;
  isLeader?: boolean;
}

/* ========================= 角色 ========================= */

export interface RoleQuery {
  keyword?: string;
  status?: Status;
}

export interface RoleListItem extends Role {
  userCount: number;
  menuCount: number;
}

/** 角色下的用户行。 */
export interface RoleUserItem extends User {
  posts: LoginPost[];
  /** 岗位直授的菜单/动作数量。 */
  postPermCount: number;
}

export interface RoleDetail extends RoleListItem {
  users: RoleUserItem[];
}

export interface CreateRoleInput {
  roleName: string;
  roleKey: string;
  roleSort?: number;
  dataScope?: DataScope;
  status?: Status;
  remark?: string | null;
}

export interface UpdateRoleInput {
  roleName?: string;
  roleKey?: string;
  roleSort?: number;
  dataScope?: DataScope;
  status?: Status;
  remark?: string | null;
}

export interface AssignRoleUsersInput {
  userIds: number[];
}

/* ========================= 菜单 ========================= */

export interface MenuQuery {
  keyword?: string;
  menuType?: MenuType;
  status?: Status;
}

export interface CreateMenuInput {
  menuName: string;
  parentId?: number;
  orderNum?: number;
  path?: string;
  component?: string | null;
  menuType: MenuType;
  status?: Status;
  perms?: string | null;
  icon?: string;
}

export interface UpdateMenuInput {
  menuName?: string;
  parentId?: number;
  orderNum?: number;
  path?: string;
  component?: string | null;
  menuType?: MenuType;
  status?: Status;
  perms?: string | null;
  icon?: string;
}

/* ========================= 权限 ========================= */

export interface SaveMenusInput {
  menuIds: number[];
}

export interface SetDataScopeInput {
  dataScope: DataScope;
  /** dataScope = '2' 时生效。 */
  orgIds?: number[];
}

/** 角色权限详情。 */
export interface RolePermissionDetail {
  roleId: number;
  roleName: string;
  roleKey: string;
  locked: boolean;
  menuIds: number[];
  dataScope: DataScope;
  scopeOrgIds: number[];
}

/** 岗位/组织权限详情。 */
export interface SubjectPermissionDetail {
  type: 'post' | 'org';
  id: number;
  name: string;
  sub: string;
  menuIds: number[];
}

/* ========================= 登录日志 ========================= */

export interface LogininforQuery extends PageQuery {
  keyword?: string;
  /** 0 成功 / 1 失败。 */
  status?: Status;
  /** 最近 N 天（与 startTime/endTime 二选一）。 */
  days?: number;
  startTime?: string;
  endTime?: string;
}

export interface LogininforStats {
  todayCount: number;
  todaySuccess: number;
  todayFail: number;
  weekUniqueUsers: number;
}

/* ========================= 工作台 ========================= */

export interface OrgHeadcount {
  orgId: number;
  orgName: string;
  headcount: number;
}

export interface DashboardStats {
  orgCount: number;
  /** 组织树最大层级。 */
  orgMaxLevel: number;
  postCount: number;
  /** 已设置责任岗位的组织数。 */
  leaderPostCount: number;
  userCount: number;
  activeUserCount: number;
  disabledUserCount: number;
  roleCount: number;
  orgHeadcounts: OrgHeadcount[];
  recentLogins: Logininfor[];
}

/** 批量操作结果：受影响记录数。 */
export interface AffectedResult {
  affected: number;
}

/** 路由通用 ID 参数。 */
export interface IdParam {
  id: number;
}
