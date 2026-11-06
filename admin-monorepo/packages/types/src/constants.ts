import type { DataScope, MenuType } from './common.js';

/**
 * 后端鉴权点常量：与 sys_menu.perms 一一对应。
 * 前端按钮显隐、后端 requirePerm 均引用这里，避免权限字符串散落。
 */
export const PERMS = {
  USER_LIST: 'system:user:list',
  USER_QUERY: 'system:user:query',
  USER_ADD: 'system:user:add',
  USER_EDIT: 'system:user:edit',
  USER_REMOVE: 'system:user:remove',
  USER_RESET_PWD: 'system:user:resetPwd',
  USER_AUTH_ROLE: 'system:user:authRole',
  USER_VIEW: 'system:user:view',

  ORG_LIST: 'system:org:list',
  ORG_QUERY: 'system:org:query',
  ORG_ADD: 'system:org:add',
  ORG_EDIT: 'system:org:edit',
  ORG_REMOVE: 'system:org:remove',
  ORG_SET_LEADER: 'system:org:setLeader',

  POST_QUERY: 'system:post:query',
  POST_ADD: 'system:post:add',
  POST_EDIT: 'system:post:edit',
  POST_REMOVE: 'system:post:remove',

  ROLE_LIST: 'system:role:list',
  ROLE_QUERY: 'system:role:query',
  ROLE_ADD: 'system:role:add',
  ROLE_EDIT: 'system:role:edit',
  ROLE_REMOVE: 'system:role:remove',
  ROLE_AUTH_USER: 'system:role:authUser',

  MENU_LIST: 'system:menu:list',
  MENU_QUERY: 'system:menu:query',
  MENU_ADD: 'system:menu:add',
  MENU_EDIT: 'system:menu:edit',
  MENU_REMOVE: 'system:menu:remove',

  PERM_LIST: 'system:perm:list',
  PERM_QUERY: 'system:perm:query',
  PERM_SAVE: 'system:perm:save',
  PERM_DATA_SCOPE: 'system:perm:dataScope',

  LOGININFOR_LIST: 'system:logininfor:list',
  LOGININFOR_QUERY: 'system:logininfor:query',
  LOGININFOR_EXPORT: 'system:logininfor:export',
  LOGININFOR_REMOVE: 'system:logininfor:remove',
  LOGININFOR_CLEAN: 'system:logininfor:clean',
} as const;

export type Perm = (typeof PERMS)[keyof typeof PERMS];

/** 数据范围中文名称。 */
export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  '1': '全部数据',
  '2': '自定义数据',
  '3': '本组织数据',
  '4': '本组织及以下数据',
  '5': '仅本人数据',
};

/** 数据范围说明，用于前端提示。 */
export const DATA_SCOPE_NOTES: Record<DataScope, string> = {
  '1': '不受组织限制，可查看全部数据',
  '2': '仅可查看勾选组织（sys_role_scope_org）的数据',
  '3': '仅可查看其任职岗位所属组织的数据',
  '4': '本组织及所有下级组织，沿 ancestors 计算',
  '5': '仅可查看本人数据',
};

/** 菜单类型中文名称。 */
export const MENU_TYPE_LABELS: Record<MenuType, string> = {
  M: '目录',
  C: '菜单',
  F: '动作',
};
