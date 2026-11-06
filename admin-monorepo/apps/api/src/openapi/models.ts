import { z } from '@hono/zod-openapi';

/**
 * OpenAPI 响应模型。
 *
 * 本文件只负责「接口返回什么」，用于 `createRoute` 生成 OpenAPI 组件；
 * 请求参数校验仍由 `src/validators` 负责，数据库表结构在
 * `packages/db/src/schema`，编译期 DTO 在 `packages/types`。
 *
 * 每个模型上方都标注了实际使用它的接口或组合模型。路由中的常见用法：
 * - `successResponse(ModelSchema, '说明')`：声明 200 响应的 data；
 * - `errorResponses` / `notFoundResponse` / `conflictResponse`：声明错误响应；
 * - `idParamsSchema` 等：声明路径参数。
 */

/* ========================= 通用 ========================= */

/** 状态枚举：被 Org / Post / User / Role / Menu / Logininfor 等模型引用。 */
export const statusSchema = z.enum(['0', '1']).openapi({
  description: '状态：0 正常，1 停用',
  example: '0',
});

/** 删除标志枚举：被实体模型引用。 */
export const delFlagSchema = z.enum(['0', '2']).openapi({
  description: '删除标志：0 存在，2 删除',
  example: '0',
});

/** 性别枚举：被 User 及其派生模型引用。 */
export const sexSchema = z.enum(['0', '1', '2']).openapi({
  description: '性别：0 男，1 女，2 未知',
  example: '0',
});

/** 菜单类型枚举：被 Menu / MenuTreeNode / UserMenuNode 引用。 */
export const menuTypeSchema = z.enum(['M', 'C', 'F']).openapi({
  description: '菜单类型：M 目录，C 菜单，F 动作',
  example: 'C',
});

/** 数据范围枚举：被 Role / LoginRole / RolePermissionDetail / UserPermissionDetail 引用。 */
export const dataScopeSchema = z.enum(['1', '2', '3', '4', '5']).openapi({
  description: '数据范围：1 全部，2 自定义，3 本组织，4 本组织及以下，5 仅本人',
  example: '1',
});

const dateTimeSchema = z.string().openapi({
  description: '日期时间，格式 YYYY-MM-DD HH:mm:ss',
  example: '2026-11-06 12:00:00',
});

const nullableDateTimeSchema = dateTimeSchema.nullable();

/** 统一响应包装。 */
function ok<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    code: z.number().int().openapi({ example: 200 }),
    message: z.string().openapi({ example: '操作成功' }),
    data,
  });
}

/** 错误响应模型。 */
/** 统一错误响应：被 errorResponses、notFoundResponse、conflictResponse 引用。 */
export const ErrorResponseSchema = z
  .object({
    code: z.number().int().openapi({ example: 400 }),
    message: z.string().openapi({ example: '请求参数错误' }),
    data: z.null(),
  })
  .openapi('ErrorResponse');

/** 构造 JSON 内容对象。 */
export function jsonContent<T extends z.ZodTypeAny>(schema: T) {
  return { 'application/json': { schema } };
}

/** 构造 200 成功响应。 */
export function successResponse<T extends z.ZodTypeAny>(data: T, description = '成功') {
  return {
    content: jsonContent(ok(data)),
    description,
  };
}

/** 通用错误响应：所有接口都可能返回。 */
export const errorResponses = {
  400: {
    content: jsonContent(ErrorResponseSchema),
    description: '请求参数错误',
  },
  401: {
    content: jsonContent(ErrorResponseSchema),
    description: '未登录或登录已过期',
  },
  403: {
    content: jsonContent(ErrorResponseSchema),
    description: '没有操作权限',
  },
  500: {
    content: jsonContent(ErrorResponseSchema),
    description: '服务器内部错误',
  },
};

/** 资源不存在响应。 */
export const notFoundResponse = {
  content: jsonContent(ErrorResponseSchema),
  description: '资源不存在或已被删除',
};

/** 唯一约束冲突响应。 */
export const conflictResponse = {
  content: jsonContent(ErrorResponseSchema),
  description: '数据已存在',
};

/* ========================= 路径参数 ========================= */

const pathId = (name: string, example: number) =>
  z.coerce.number().int().positive().openapi({
    param: { name, in: 'path' },
    description: `${name} 必须是正整数`,
    example,
  });

/** 路径参数 `{id}`：用户、组织、岗位、菜单、登录日志详情接口。 */
export const idParamsSchema = z.object({ id: pathId('id', 1) });
/** 路径参数 `{roleId}`：角色权限相关接口。 */
export const roleIdParamsSchema = z.object({ roleId: pathId('roleId', 2) });
/** 路径参数 `{postId}`：岗位权限相关接口。 */
export const postIdParamsSchema = z.object({ postId: pathId('postId', 1) });
/** 路径参数 `{orgId}`：组织权限相关接口。 */
export const orgIdParamsSchema = z.object({ orgId: pathId('orgId', 100) });

/* ========================= 实体 ========================= */

/** 组织基础模型：被 OrgTreeNode、OrgDetail 组合引用。 */
export const OrgSchema = z
  .object({
    orgId: z.number().int().openapi({ example: 100 }),
    parentId: z.number().int().openapi({ example: 0 }),
    ancestors: z.string().openapi({ example: '0', description: '逗号分隔的祖级组织路径' }),
    orgCode: z.string().openapi({ example: 'ZZ20260101000001' }),
    orgName: z.string().openapi({ example: '云枢科技集团' }),
    orgLevel: z.number().int().openapi({ example: 1 }),
    orderNum: z.number().int().openapi({ example: 0 }),
    leaderPostId: z.number().int().nullable().openapi({ example: 1 }),
    status: statusSchema,
    delFlag: delFlagSchema,
    createBy: z.string().openapi({ example: 'admin' }),
    createTime: dateTimeSchema,
    updateBy: z.string().openapi({ example: 'admin' }),
    updateTime: nullableDateTimeSchema,
  })
  .openapi('Org');

/** 组织树节点：GET /api/orgs 的 data。 */
export const OrgTreeNodeSchema: z.ZodType<unknown> = z
  .lazy(() =>
    OrgSchema.extend({
      postCount: z.number().int().openapi({ description: '本组织正常状态的岗位数量' }),
      children: z.array(OrgTreeNodeSchema),
    }),
  )
  .openapi('OrgTreeNode');

/** 岗位基础模型：被 PostTreeNode、PostDetail、OrgDetail.posts 引用。 */
export const PostSchema = z
  .object({
    postId: z.number().int().openapi({ example: 1 }),
    orgId: z.number().int().openapi({ example: 100 }),
    parentId: z.number().int().openapi({ example: 0 }),
    postCode: z.string().openapi({ example: 'GW20260101000001' }),
    postName: z.string().openapi({ example: '董事长' }),
    postSort: z.number().int().openapi({ example: 0 }),
    status: statusSchema,
    delFlag: delFlagSchema,
    createBy: z.string().openapi({ example: 'admin' }),
    createTime: dateTimeSchema,
    updateBy: z.string().openapi({ example: 'admin' }),
    updateTime: nullableDateTimeSchema,
  })
  .openapi('Post');

/** 岗位树节点：GET /api/posts 的 data。 */
export const PostTreeNodeSchema: z.ZodType<unknown> = z
  .lazy(() =>
    PostSchema.extend({
      headcount: z.number().int().openapi({ description: '正常状态在岗人数' }),
      isLeader: z.boolean().openapi({ description: '是否为所属组织的责任岗位' }),
      children: z.array(PostTreeNodeSchema),
    }),
  )
  .openapi('PostTreeNode');

/** 岗位详情：GET/POST/PUT /api/posts 的 data。 */
export const PostDetailSchema = PostSchema.extend({
  orgName: z.string().openapi({ example: '云枢科技集团' }),
  orgPath: z.string().openapi({ example: '云枢科技集团' }),
  ancestorIds: z.array(z.number().int()),
  headcount: z.number().int(),
  isLeader: z.boolean(),
}).openapi('PostDetail');

/** 用户基础模型：被 UserListItem、OrgUserItem、RoleUserItem 组合引用。 */
export const UserSchema = z
  .object({
    userId: z.number().int().openapi({ example: 1 }),
    userName: z.string().openapi({ example: 'admin' }),
    nickName: z.string().openapi({ example: '超级管理员' }),
    email: z.string().openapi({ example: 'admin@cloudhub.cn' }),
    phonenumber: z.string().openapi({ example: '13800000000' }),
    sex: sexSchema,
    status: statusSchema,
    delFlag: delFlagSchema,
    createBy: z.string().openapi({ example: 'admin' }),
    createTime: dateTimeSchema,
    updateBy: z.string().openapi({ example: 'admin' }),
    updateTime: nullableDateTimeSchema,
  })
  .openapi('User');

/** 角色基础模型：被 RoleListItem、RoleDetail 组合引用。 */
export const RoleSchema = z
  .object({
    roleId: z.number().int().openapi({ example: 2 }),
    roleName: z.string().openapi({ example: '总经理' }),
    roleKey: z.string().openapi({ example: 'general_manager' }),
    roleSort: z.number().int().openapi({ example: 1 }),
    dataScope: dataScopeSchema,
    status: statusSchema,
    delFlag: delFlagSchema,
    createBy: z.string().openapi({ example: 'admin' }),
    createTime: dateTimeSchema,
    updateBy: z.string().openapi({ example: 'admin' }),
    updateTime: nullableDateTimeSchema,
    remark: z.string().nullable().openapi({ example: '角色说明' }),
  })
  .openapi('Role');

/** 菜单基础模型：被 MenuRow、MenuTreeNode 引用，也是菜单增删改查的 data。 */
export const MenuSchema = z
  .object({
    menuId: z.number().int().openapi({ example: 1001 }),
    menuName: z.string().openapi({ example: '系统管理' }),
    parentId: z.number().int().openapi({ example: 1000 }),
    orderNum: z.number().int().openapi({ example: 1 }),
    path: z.string().openapi({ example: '/system' }),
    component: z.string().nullable().openapi({ example: null }),
    menuType: menuTypeSchema,
    status: statusSchema,
    perms: z.string().nullable().openapi({ example: null }),
    icon: z.string().openapi({ example: 'setting' }),
    createBy: z.string().openapi({ example: 'admin' }),
    createTime: dateTimeSchema,
    updateBy: z.string().openapi({ example: 'admin' }),
    updateTime: nullableDateTimeSchema,
  })
  .openapi('Menu');

/** 菜单树节点：GET /api/menus/tree 的 data。 */
export const MenuTreeNodeSchema: z.ZodType<unknown> = z
  .lazy(() =>
    MenuSchema.extend({
      children: z.array(MenuTreeNodeSchema),
    }),
  )
  .openapi('MenuTreeNode');

/** 登录日志：GET /api/logs/logininfor/{id}、分页列表项、工作台 recentLogins。 */
export const LogininforSchema = z
  .object({
    infoId: z.number().int().openapi({ example: 1 }),
    userName: z.string().openapi({ example: 'admin' }),
    postName: z.string().openapi({ example: '董事长' }),
    ipaddr: z.string().openapi({ example: '127.0.0.1' }),
    loginLocation: z.string().openapi({ example: '内网' }),
    browser: z.string().openapi({ example: 'Chrome' }),
    os: z.string().openapi({ example: 'Windows 11' }),
    status: statusSchema,
    msg: z.string().openapi({ example: '登录成功' }),
    loginTime: dateTimeSchema,
  })
  .openapi('Logininfor');

/* ========================= 登录与个人信息 ========================= */

/** 登录岗位：UserProfile.posts、UserListItem.posts、OrgUserItem.posts、RoleUserItem.posts。 */
export const LoginPostSchema = z
  .object({
    postId: z.number().int().openapi({ example: 1 }),
    postName: z.string().openapi({ example: '董事长' }),
    orgId: z.number().int().openapi({ example: 100 }),
    orgName: z.string().openapi({ example: '云枢科技集团' }),
    orgPath: z.string().openapi({ example: '云枢科技集团' }),
    isLeader: z.boolean().openapi({ example: true }),
  })
  .openapi('LoginPost');

/** 登录角色：UserProfile.roles、UserListItem.roles。 */
export const LoginRoleSchema = z
  .object({
    roleId: z.number().int().openapi({ example: 1 }),
    roleName: z.string().openapi({ example: '超级管理员' }),
    roleKey: z.string().openapi({ example: 'admin' }),
    dataScope: dataScopeSchema,
  })
  .openapi('LoginRole');

/** 用户可访问菜单节点：UserProfile.menus。 */
export const UserMenuNodeSchema: z.ZodType<unknown> = z
  .lazy(() =>
    z
      .object({
        menuId: z.number().int().openapi({ example: 1000 }),
        menuName: z.string().openapi({ example: '系统管理' }),
        parentId: z.number().int().openapi({ example: 0 }),
        orderNum: z.number().int().openapi({ example: 1 }),
        path: z.string().openapi({ example: '/system' }),
        component: z.string().nullable().openapi({ example: null }),
        menuType: menuTypeSchema,
        status: statusSchema,
        perms: z.string().nullable().openapi({ example: null }),
        icon: z.string().openapi({ example: 'setting' }),
        children: z.array(UserMenuNodeSchema),
      })
      .openapi('UserMenuNode'),
  );

/** 当前用户资料：GET /api/auth/me 的 data，也是 LoginResult.profile。 */
export const UserProfileSchema = z
  .object({
    userId: z.number().int(),
    userName: z.string(),
    nickName: z.string(),
    email: z.string(),
    phonenumber: z.string(),
    sex: sexSchema,
    status: statusSchema,
    posts: z.array(LoginPostSchema),
    roles: z.array(LoginRoleSchema),
    permissions: z.array(z.string()),
    menus: z.array(UserMenuNodeSchema),
    currentPost: LoginPostSchema.nullable(),
  })
  .openapi('UserProfile');

/** 登录结果：POST /api/auth/login、POST /api/auth/refresh 的 data。 */
export const LoginResultSchema = z
  .object({
    token: z.string().openapi({ description: 'JWT 访问令牌' }),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().openapi({ description: '有效期（秒）', example: 86400 }),
    profile: UserProfileSchema,
  })
  .openapi('LoginResult');

/** 权限来源明细：UserPermissionDetail.sources。 */
export const PermissionSourceSchema = z
  .object({
    key: z.string().openapi({ example: 'role:2' }),
    type: z.enum(['user', 'post', 'org']).openapi({ description: '权限来源类型' }),
    sourceId: z.number().int().openapi({ example: 2 }),
    name: z.string().openapi({ example: '总经理' }),
    sub: z.string().openapi({ example: '数据范围：本组织及以下' }),
    menuIds: z.array(z.number().int()),
  })
  .openapi('PermissionSource');

/** 用户权限详情：GET /api/users/{id}/permissions 的 data。 */
export const UserPermissionDetailSchema = z
  .object({
    userId: z.number().int(),
    userName: z.string(),
    nickName: z.string(),
    menuIds: z.array(z.number().int()),
    sources: z.array(PermissionSourceSchema),
    dataScope: dataScopeSchema,
    dataScopeOrgIds: z.array(z.number().int()),
  })
  .openapi('UserPermissionDetail');

/* ========================= 业务 DTO ========================= */

/** 用户列表项/详情：GET /api/users、GET /api/users/{id}、POST /api/users、PUT /api/users/{id}、PUT /api/users/{id}/roles。 */
export const UserListItemSchema = UserSchema.extend({
  posts: z.array(LoginPostSchema),
  roles: z.array(LoginRoleSchema),
  postPermCount: z.number().int().openapi({ description: '岗位直授的菜单/动作数量' }),
  orgPermCount: z.number().int().openapi({ description: '组织直授的菜单/动作数量' }),
}).openapi('UserListItem');

/** 组织详情：GET /api/orgs/{id}、POST /api/orgs、PUT /api/orgs/{id} 的 data。 */
export const OrgDetailSchema = OrgSchema.extend({
  posts: z.array(PostSchema),
  headcount: z.number().int(),
}).openapi('OrgDetail');

/** 组织在岗用户：GET /api/orgs/{id}/users 的列表项。 */
export const OrgUserItemSchema = UserSchema.extend({
  posts: z.array(LoginPostSchema),
}).openapi('OrgUserItem');

/** 角色列表项：GET /api/roles 的列表项。 */
export const RoleListItemSchema = RoleSchema.extend({
  userCount: z.number().int(),
  menuCount: z.number().int(),
}).openapi('RoleListItem');

/** 角色成员：GET/PUT /api/roles/{id}/users 的列表项。 */
export const RoleUserItemSchema = UserSchema.extend({
  posts: z.array(LoginPostSchema),
  postPermCount: z.number().int(),
}).openapi('RoleUserItem');

/** 角色详情：GET /api/roles/{id}、POST /api/roles、PUT /api/roles/{id} 的 data。 */
export const RoleDetailSchema = RoleListItemSchema.extend({
  users: z.array(RoleUserItemSchema),
}).openapi('RoleDetail');

/** 扁平菜单行：GET /api/menus 的列表项。 */
export const MenuRowSchema = MenuSchema.extend({
  level: z.number().int().openapi({ description: '树层级，从 1 开始' }),
  hasChild: z.boolean(),
}).openapi('MenuRow');

/** 组织人数：DashboardStats.orgHeadcounts 的列表项。 */
export const OrgHeadcountSchema = z
  .object({
    orgId: z.number().int(),
    orgName: z.string(),
    headcount: z.number().int(),
  })
  .openapi('OrgHeadcount');

/** 工作台统计：GET /api/dashboard/stats 的 data。 */
export const DashboardStatsSchema = z
  .object({
    orgCount: z.number().int(),
    orgMaxLevel: z.number().int(),
    postCount: z.number().int(),
    leaderPostCount: z.number().int(),
    userCount: z.number().int(),
    activeUserCount: z.number().int(),
    disabledUserCount: z.number().int(),
    roleCount: z.number().int(),
    orgHeadcounts: z.array(OrgHeadcountSchema),
    recentLogins: z.array(LogininforSchema),
  })
  .openapi('DashboardStats');

/** 登录日志概览：GET /api/logs/logininfor/stats 的 data。 */
export const LogininforStatsSchema = z
  .object({
    todayCount: z.number().int(),
    todaySuccess: z.number().int(),
    todayFail: z.number().int(),
    weekUniqueUsers: z.number().int(),
  })
  .openapi('LogininforStats');

/** 角色权限详情：GET /api/perms/role/{roleId}、PUT .../menus、PUT .../data-scope 的 data。 */
export const RolePermissionDetailSchema = z
  .object({
    roleId: z.number().int(),
    roleName: z.string(),
    roleKey: z.string(),
    locked: z.boolean().openapi({ description: '超级管理员角色锁定，不可修改' }),
    menuIds: z.array(z.number().int()),
    dataScope: dataScopeSchema,
    scopeOrgIds: z.array(z.number().int()),
  })
  .openapi('RolePermissionDetail');

/** 岗位/组织权限详情：GET/PUT /api/perms/post/{postId} 与 /api/perms/org/{orgId} 的 data。 */
export const SubjectPermissionDetailSchema = z
  .object({
    type: z.enum(['post', 'org']),
    id: z.number().int(),
    name: z.string(),
    sub: z.string(),
    menuIds: z.array(z.number().int()),
  })
  .openapi('SubjectPermissionDetail');

/** 责任岗位结果：PUT /api/orgs/{id}/leader 的 data。 */
export const LeaderPostResultSchema = z
  .object({
    leaderPostId: z.number().int().nullable(),
  })
  .openapi('LeaderPostResult');

/** 批量操作结果：DELETE /api/logs/logininfor、DELETE /api/logs/logininfor/clean 的 data。 */
export const AffectedResultSchema = z
  .object({
    affected: z.number().int().openapi({ description: '受影响记录数' }),
  })
  .openapi('AffectedResult');

/* ========================= 分页 ========================= */

function pageResult<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    list: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
}

/** 用户分页结果：GET /api/users 的 data。 */
export const UserPageResultSchema = pageResult(UserListItemSchema).openapi('UserPageResult');
/** 组织用户分页结果：GET /api/orgs/{id}/users 的 data。 */
export const OrgUserPageResultSchema = pageResult(OrgUserItemSchema).openapi(
  'OrgUserPageResult',
);
/** 登录日志分页结果：GET /api/logs/logininfor 的 data。 */
export const LogininforPageResultSchema = pageResult(LogininforSchema).openapi(
  'LogininforPageResult',
);
