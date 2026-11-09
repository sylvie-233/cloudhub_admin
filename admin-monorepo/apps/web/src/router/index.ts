import { PERMS } from '@cloudhub/types';
import { toast } from '@cloudhub/ui';
import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          redirect: { name: 'dashboard' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'orgs',
          name: 'orgs',
          component: () => import('@/views/OrgView.vue'),
          meta: { title: '组织管理', perm: PERMS.ORG_LIST },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UserView.vue'),
          meta: { title: '用户管理', perm: PERMS.USER_LIST },
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/views/RoleView.vue'),
          meta: { title: '角色管理', perm: PERMS.ROLE_LIST },
        },
        {
          path: 'menus',
          name: 'menus',
          component: () => import('@/views/MenuView.vue'),
          meta: { title: '菜单管理', perm: PERMS.MENU_LIST },
        },
        {
          path: 'permissions',
          name: 'permissions',
          component: () => import('@/views/PermissionView.vue'),
          meta: { title: '权限管理', perm: PERMS.PERM_LIST },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/LogView.vue'),
          meta: { title: '系统日志', perm: PERMS.LOGININFOR_LIST },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'dashboard' },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'dashboard' };
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (!auth.profile) {
    try {
      await auth.fetchProfile();
    } catch {
      auth.clearSession();
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      };
    }
  }

  if (to.meta.perm && !auth.hasPerm(to.meta.perm)) {
    toast.error('无权访问该页面');
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  const title = to.meta.title ?? '';
  document.title = title ? `${title} · 云枢 Admin` : '云枢 Admin';
});

export default router;
