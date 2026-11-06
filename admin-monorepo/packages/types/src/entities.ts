import type { DataScope, DelFlag, MenuType, Sex, Status } from './common.js';

/** 组织。 */
export interface Org {
  orgId: number;
  parentId: number;
  ancestors: string;
  orgCode: string;
  orgName: string;
  orgLevel: number;
  orderNum: number;
  leaderPostId: number | null;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

/** 组织树节点。 */
export interface OrgTreeNode extends Org {
  children: OrgTreeNode[];
  /** 本组织正常状态的岗位数量。 */
  postCount: number;
}

/** 岗位。 */
export interface Post {
  postId: number;
  orgId: number;
  parentId: number;
  postCode: string;
  postName: string;
  postSort: number;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

/** 岗位树节点。 */
export interface PostTreeNode extends Post {
  children: PostTreeNode[];
  /** 正常状态在岗人数。 */
  headcount: number;
  /** 是否为所属组织的责任岗位。 */
  isLeader: boolean;
}

/** 岗位详情（含组织路径）。 */
export interface PostDetail extends Post {
  orgName: string;
  orgPath: string;
  ancestorIds: number[];
  headcount: number;
  isLeader: boolean;
}

/** 用户（不包含密码）。 */
export interface User {
  userId: number;
  userName: string;
  nickName: string;
  email: string;
  phonenumber: string;
  sex: Sex;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

/** 角色。 */
export interface Role {
  roleId: number;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope: DataScope;
  status: Status;
  delFlag: DelFlag;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
  remark: string | null;
}

/** 菜单（M 目录 / C 菜单 / F 动作）。 */
export interface Menu {
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
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string | null;
}

/** 菜单树节点。 */
export interface MenuTreeNode extends Menu {
  children: MenuTreeNode[];
}

/** 扁平菜单行（含树层级）。 */
export interface MenuRow extends Menu {
  level: number;
  hasChild: boolean;
}

/** 登录日志。 */
export interface Logininfor {
  infoId: number;
  userName: string;
  postName: string;
  ipaddr: string;
  loginLocation: string;
  browser: string;
  os: string;
  status: Status;
  msg: string;
  loginTime: string;
}
