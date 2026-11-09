import type { UserMenuNode } from '@cloudhub/types';
import { toast } from '@cloudhub/ui';
import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { buildMenuRoutes } from './menu-routes';

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
      name: 'layout',
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
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
});

let installedMenuSignature = '';
const removeMenuRoutes: Array<() => void> = [];

/** 清空按菜单动态注册的路由。 */
export function resetMenuRoutes(): void {
  for (const remove of removeMenuRoutes.splice(0)) {
    remove();
  }
  installedMenuSignature = '';
}

/**
 * 同步菜单路由：菜单相同则直接返回，发生变化时整体重建，
 * 避免登录、退出或权限刷新后残留旧路由。
 */
export function syncMenuRoutes(menus: UserMenuNode[]): boolean {
  const signature = JSON.stringify(menus);
  if (signature === installedMenuSignature) {
    return false;
  }

  resetMenuRoutes();
  const { routes, warnings } = buildMenuRoutes(menus);
  for (const warning of warnings) {
    console.warn('[router:menu]', warning);
  }
  for (const route of routes) {
    removeMenuRoutes.push(router.addRoute('layout', route));
  }
  installedMenuSignature = signature;
  return true;
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (auth.isAuthenticated && !auth.profileError && to.name === 'login') {
      return { name: 'dashboard' };
    }
    if (!auth.isAuthenticated || auth.profileError) {
      resetMenuRoutes();
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    resetMenuRoutes();
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (!auth.profile) {
    try {
      await auth.fetchProfile();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) {
        auth.clearSession();
        toast.error('登录状态已失效，请重新登录');
      } else {
        // 网络中断或服务端异常不应直接清空登录态，仅阻止本次进入并保留令牌
        auth.profileError = true;
        toast.error(error instanceof Error ? error.message : '用户信息加载失败，请稍后重试');
      }
      resetMenuRoutes();
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      };
    }
  }

  if (!auth.profile) {
    resetMenuRoutes();
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  const changed = syncMenuRoutes(auth.profile.menus);

  // 首次进入时动态路由尚未安装，当前导航会先匹配到兜底路由；
  // 安装完成后按原地址重新匹配一次。
  if (to.name === 'not-found') {
    if (changed) {
      return { path: to.path, query: to.query, hash: to.hash, replace: true };
    }
    return true;
  }

  if (
    changed &&
    typeof to.name === 'string' &&
    to.name.startsWith('menu-') &&
    !router.hasRoute(to.name)
  ) {
    toast.error('页面权限已变更，请重新选择页面');
    return { name: 'dashboard' };
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
