import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import logRoutes from './log.js';
import menuRoutes from './menu.js';
import orgRoutes from './org.js';
import permRoutes from './perm.js';
import postRoutes from './post.js';
import roleRoutes from './role.js';
import userRoutes from './user.js';
import { createApiRouter } from '../openapi/router.js';

const router = createApiRouter();

router.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: '登录接口返回的 JWT，请在请求头中携带：Authorization: Bearer <token>',
});

router.route('/auth', authRoutes);
router.route('/dashboard', dashboardRoutes);
router.route('/users', userRoutes);
router.route('/orgs', orgRoutes);
router.route('/posts', postRoutes);
router.route('/roles', roleRoutes);
router.route('/menus', menuRoutes);
router.route('/perms', permRoutes);
router.route('/logs', logRoutes);

router.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'CloudHub Admin API',
    version: '1.0.0',
    description: [
      'CloudHub 组织权限管理后台 API。',
      '',
      '功能权限 = 角色 ∪ 岗位 ∪ 组织；数据权限只来源于角色。',
      '除登录接口外，所有接口均需携带 JWT。',
    ].join('\n'),
  },
  servers: [{ url: '/api', description: '当前服务' }],
  tags: [
    { name: '认证', description: '登录、登出、令牌续期与当前用户信息' },
    { name: '工作台', description: '首页统计数据' },
    { name: '用户', description: '用户管理与授权' },
    { name: '组织', description: '组织树、责任岗位与组织成员' },
    { name: '岗位', description: '岗位树与岗位管理' },
    { name: '角色', description: '角色管理与成员分配' },
    { name: '菜单', description: '目录 / 菜单 / 动作管理' },
    { name: '权限', description: '角色、岗位、组织的菜单授权与数据范围' },
    { name: '登录日志', description: '登录日志查询、导出与清理' },
  ],
  security: [{ BearerAuth: [] }],
});

export default router;
